import asyncio
import flet as ft
from ui.components import message_bubble
import db
import memory as mem
import ollama_client as oc

UPDATE_INTERVAL_CHARS = 8  # batch UI updates every N chars for smooth streaming


class ChatView(ft.Column):
    def __init__(self, page: ft.Page, conv_id: int, model: str):
        super().__init__(expand=True, spacing=0)
        self.page = page
        self.conv_id = conv_id
        self.current_model = model
        self.streaming = False
        self._stream_cancel = False
        self._active_bubble: ft.Container | None = None
        self._active_content: str = ""

        self._messages_col = ft.Column(
            controls=[],
            spacing=12,
            scroll=ft.ScrollMode.AUTO,
            expand=True,
            auto_scroll=True,
        )

        self._input = ft.TextField(
            hint_text="Message Golem...",
            multiline=True,
            min_lines=1,
            max_lines=8,
            expand=True,
            border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
            focused_border_color=ft.Colors.BLUE_400,
            text_size=14,
            on_submit=self._on_submit,
            shift_enter=True,
        )

        self._send_btn = ft.IconButton(
            icon=ft.Icons.SEND_ROUNDED,
            icon_color=ft.Colors.BLUE_400,
            tooltip="Send (Enter)",
            on_click=self._on_submit,
        )

        self._stop_btn = ft.IconButton(
            icon=ft.Icons.STOP_CIRCLE_OUTLINED,
            icon_color=ft.Colors.RED_400,
            tooltip="Stop generation",
            on_click=self._on_stop,
            visible=False,
        )

        input_row = ft.Row(
            controls=[self._input, self._stop_btn, self._send_btn],
            vertical_alignment=ft.CrossAxisAlignment.END,
        )

        input_container = ft.Container(
            content=input_row,
            bgcolor=ft.Colors.with_opacity(0.06, ft.Colors.WHITE),
            border_radius=ft.border_radius.all(12),
            padding=ft.padding.symmetric(horizontal=12, vertical=8),
            border=ft.border.all(1, ft.Colors.with_opacity(0.12, ft.Colors.WHITE)),
        )

        self.controls = [
            ft.Container(content=self._messages_col, expand=True, padding=ft.padding.symmetric(horizontal=16, vertical=8)),
            ft.Container(content=input_container, padding=ft.padding.symmetric(horizontal=16, vertical=12)),
        ]

    def load_history(self):
        """Load existing messages from DB into the view."""
        self._messages_col.controls.clear()
        rows = db.get_messages(self.conv_id)
        for row in rows:
            if row["role"] == "system":
                continue
            bubble = message_bubble(row["role"], row["content"], on_copy=self._copy_text)
            self._messages_col.controls.append(bubble)

    def _add_bubble(self, role: str, content: str) -> ft.Markdown | ft.Text:
        """Add a bubble to the view and return the inner content control."""
        if role == "user":
            inner = ft.Text(content, selectable=True, color=ft.Colors.WHITE, size=14)
        else:
            inner = ft.Markdown(
                content,
                selectable=True,
                extension_set=ft.MarkdownExtensionSet.GITHUB_WEB,
                code_theme="atom-one-dark",
                code_style=ft.TextStyle(font_family="Cascadia Code, Consolas, monospace"),
                on_tap_link=lambda e: ft.launch_url(e.data),
            )

        is_user = role == "user"
        copy_btn = ft.IconButton(
            icon=ft.Icons.COPY_OUTLINED,
            icon_size=14,
            icon_color=ft.Colors.with_opacity(0.5, ft.Colors.WHITE),
            tooltip="Copy",
            on_click=lambda _, c=inner: self._copy_from_control(c),
            style=ft.ButtonStyle(padding=ft.padding.all(4)),
        )

        bubble_container = ft.Container(
            content=ft.Column(
                controls=[inner, ft.Row([copy_btn], alignment=ft.MainAxisAlignment.END)],
                spacing=2,
                tight=True,
            ),
            bgcolor=ft.Colors.with_opacity(0.15, ft.Colors.WHITE) if is_user else ft.Colors.with_opacity(0.06, ft.Colors.WHITE),
            border_radius=ft.border_radius.all(12),
            padding=ft.padding.symmetric(horizontal=16, vertical=12),
        )

        row = ft.Row(
            controls=[
                ft.Container(expand=True) if is_user else ft.Container(width=8),
                ft.Container(content=bubble_container, expand=not is_user, width=600 if is_user else None),
                ft.Container(width=8) if is_user else ft.Container(expand=True),
            ],
            vertical_alignment=ft.CrossAxisAlignment.START,
        )

        self._messages_col.controls.append(row)
        return inner

    def _copy_text(self, text: str):
        self.page.set_clipboard(text)

    def _copy_from_control(self, control):
        text = control.value if hasattr(control, "value") else control.data
        if text:
            self.page.set_clipboard(text)

    async def _on_submit(self, e=None):
        text = self._input.value.strip()
        if not text or self.streaming:
            return
        self._input.value = ""
        await self._send(text)

    async def _on_stop(self, e=None):
        self._stream_cancel = True

    async def _send(self, user_text: str):
        # Save + show user message
        db.add_message(self.conv_id, "user", user_text)
        self._add_bubble("user", user_text)

        # Auto-title on first user message
        conv = db.get_conversation(self.conv_id)
        if conv and conv["title"] == "New Chat":
            title = user_text[:50].rsplit(" ", 1)[0] if len(user_text) > 50 else user_text
            db.rename_conversation(self.conv_id, title)

        # Empty assistant bubble
        assistant_inner = self._add_bubble("assistant", "")

        self.streaming = True
        self._stream_cancel = False
        self._send_btn.visible = False
        self._stop_btn.visible = True
        await self.page.update_async()

        # Build payload from history
        rows = db.get_messages(self.conv_id)
        messages = [{"role": r["role"], "content": r["content"]} for r in rows if r["role"] != "system"]
        system_prompt = mem.build_system_prompt()
        payload = oc.build_chat_payload(
            model=self.current_model,
            messages=messages,
            system_prompt=system_prompt,
        )

        buffer = ""
        chars_since_update = 0

        try:
            async for chunk in oc.stream_chat(payload):
                if self._stream_cancel:
                    break
                buffer += chunk
                chars_since_update += len(chunk)

                if chars_since_update >= UPDATE_INTERVAL_CHARS:
                    assistant_inner.value = buffer
                    chars_since_update = 0
                    await self.page.update_async()

        except oc.OllamaOfflineError as ex:
            buffer = f"**Error:** {ex}"
        except Exception as ex:
            buffer += f"\n\n**Error:** {ex}"
        finally:
            # Flush final content
            assistant_inner.value = buffer
            db.add_message(self.conv_id, "assistant", buffer)
            self.streaming = False
            self._stream_cancel = False
            self._send_btn.visible = True
            self._stop_btn.visible = False
            await self.page.update_async()
