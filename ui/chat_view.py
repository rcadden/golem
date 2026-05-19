import webbrowser
import flet as ft
import db
import memory as mem
import ollama_client as oc

UPDATE_INTERVAL_CHARS = 8

MAIN_BG      = ft.Colors.SURFACE
INPUT_BG     = ft.Colors.SURFACE_CONTAINER
USER_BG      = ft.Colors.SURFACE_CONTAINER_HIGH
TEXT_PRIMARY = ft.Colors.ON_SURFACE
TEXT_MUTED   = ft.Colors.ON_SURFACE_VARIANT
ACCENT       = ft.Colors.PRIMARY
BORDER       = ft.Colors.OUTLINE_VARIANT

_CODE_STYLE = ft.MarkdownStyleSheet(
    code_text_style=ft.TextStyle(font_family="Cascadia Code, Consolas, monospace"),
    p_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h1_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h2_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h3_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h4_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h5_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    h6_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    em_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
    strong_text_style=ft.TextStyle(color=ft.Colors.ON_SURFACE),
)


def _avatar() -> ft.Container:
    return ft.Container(
        content=ft.Text("G", size=10, weight=ft.FontWeight.BOLD,
                        color=ft.Colors.ON_PRIMARY),
        width=22, height=22,
        border_radius=ft.BorderRadius.all(11),
        bgcolor=ACCENT,
        alignment=ft.Alignment(0, 0),
        margin=ft.Margin.only(top=1, right=10),
    )


def _markdown(value: str = "") -> ft.Markdown:
    return ft.Markdown(
        value,
        selectable=True,
        extension_set=ft.MarkdownExtensionSet.GITHUB_WEB,
        code_theme="atom-one-dark",
        code_style_sheet=_CODE_STYLE,
        on_tap_link=lambda e: webbrowser.open(e.data),
    )


class ChatView(ft.Column):
    def __init__(self, page: ft.Page, conv_id: int, model: str, models: list[str]):
        super().__init__(expand=True, spacing=0)
        self._pg           = page
        self.conv_id       = conv_id
        self.current_model = model
        self._models       = models
        self.streaming     = False
        self._cancel       = False

        # ── Message list ──────────────────────────────────────────────────────
        self._msgs = ft.Column(
            controls=[],
            spacing=20,
            scroll=ft.ScrollMode.AUTO,
            expand=True,
            auto_scroll=True,
        )

        # ── Input ─────────────────────────────────────────────────────────────
        self._input = ft.TextField(
            hint_text="Message Golem…",
            hint_style=ft.TextStyle(color=TEXT_MUTED),
            multiline=True,
            min_lines=1,
            max_lines=8,
            expand=True,
            border=ft.InputBorder.NONE,
            focused_border_color=ft.Colors.TRANSPARENT,
            text_size=14,
            color=TEXT_PRIMARY,
            cursor_color=ACCENT,
            on_submit=self._on_submit,
            shift_enter=True,
        )

        self._send_btn = ft.IconButton(
            icon=ft.Icons.ARROW_UPWARD_ROUNDED,
            icon_color=ft.Colors.ON_PRIMARY,
            bgcolor=ACCENT,
            icon_size=17,
            tooltip="Send  (Enter)",
            on_click=self._on_submit,
            style=ft.ButtonStyle(
                shape=ft.CircleBorder(),
                padding=ft.Padding.all(5),
            ),
        )

        self._stop_btn = ft.IconButton(
            icon=ft.Icons.STOP_ROUNDED,
            icon_color=ft.Colors.ON_SURFACE,
            bgcolor=ft.Colors.SURFACE_CONTAINER_HIGH,
            icon_size=17,
            tooltip="Stop",
            on_click=self._on_stop,
            visible=False,
            style=ft.ButtonStyle(
                shape=ft.CircleBorder(),
                padding=ft.Padding.all(5),
            ),
        )

        model_opts = (
            [ft.dropdown.Option(key=m, text=m) for m in models]
            if models else
            [ft.dropdown.Option(key="none", text="No models")]
        )
        self._model_dd = ft.Dropdown(
            value=model,
            options=model_opts,
            border=ft.InputBorder.NONE,
            text_size=12,
            color=TEXT_MUTED,
            dense=True,
            content_padding=ft.Padding.symmetric(horizontal=4, vertical=0),
            width=190,
            disabled=not models,
            on_select=self._on_model_change,
        )

        input_box = ft.Container(
            content=ft.Column(
                controls=[
                    self._input,
                    ft.Row(
                        controls=[
                            self._model_dd,
                            ft.Container(expand=True),
                            self._stop_btn,
                            self._send_btn,
                        ],
                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                ],
                spacing=6,
                tight=True,
            ),
            bgcolor=INPUT_BG,
            border_radius=ft.BorderRadius.all(16),
            border=ft.Border.all(1, BORDER),
            padding=ft.Padding.only(left=16, right=12, top=12, bottom=10),
        )

        self.controls = [
            ft.Container(
                content=self._msgs,
                expand=True,
                padding=ft.Padding.symmetric(horizontal=48, vertical=20),
            ),
            ft.Container(
                content=input_box,
                padding=ft.Padding.only(left=48, right=48, bottom=28, top=4),
            ),
        ]

    # ── Model change ──────────────────────────────────────────────────────────

    def _on_model_change(self, e):
        self.current_model = self._model_dd.value or self.current_model
        db.set_setting("default_model", self.current_model)

    # ── History ───────────────────────────────────────────────────────────────

    def load_history(self):
        self._msgs.controls.clear()
        for row in db.get_messages(self.conv_id):
            if row["role"] == "system":
                continue
            if row["role"] == "user":
                self._msgs.controls.append(self._user_row(row["content"]))
            else:
                assistant_row, _ = self._assistant_row(row["content"])
                self._msgs.controls.append(assistant_row)

    # ── Message builders ──────────────────────────────────────────────────────

    def _user_row(self, text: str) -> ft.Row:
        bubble = ft.Container(
            content=ft.Text(text, selectable=True, color=TEXT_PRIMARY, size=14),
            bgcolor=USER_BG,
            border_radius=ft.BorderRadius.all(18),
            padding=ft.Padding.symmetric(horizontal=16, vertical=10),
        )
        return ft.Row(
            controls=[ft.Container(expand=True), ft.Container(content=bubble, width=540)],
        )

    def _assistant_row(self, text: str = "") -> tuple:
        md = _markdown(text)
        row = ft.Row(
            controls=[
                _avatar(),
                ft.Container(content=md, expand=True),
            ],
            vertical_alignment=ft.CrossAxisAlignment.START,
        )
        return row, md

    # ── Events ────────────────────────────────────────────────────────────────

    async def _on_submit(self, e=None):
        text = self._input.value.strip()
        if not text or self.streaming:
            return
        self._input.value = ""
        await self._send(text)

    async def _on_stop(self, e=None):
        self._cancel = True

    # ── Send / stream ─────────────────────────────────────────────────────────

    async def _send(self, user_text: str):
        db.add_message(self.conv_id, "user", user_text)
        self._msgs.controls.append(self._user_row(user_text))

        # Auto-title
        conv = db.get_conversation(self.conv_id)
        if conv and conv["title"] == "New Chat":
            title = user_text[:50].rsplit(" ", 1)[0] if len(user_text) > 50 else user_text
            db.rename_conversation(self.conv_id, title)

        row, md = self._assistant_row("")
        self._msgs.controls.append(row)

        self.streaming = True
        self._cancel   = False
        self._send_btn.visible = False
        self._stop_btn.visible = True
        self._pg.update()

        history = db.get_messages(self.conv_id)
        messages = [{"role": r["role"], "content": r["content"]} for r in history if r["role"] != "system"]
        payload  = oc.build_chat_payload(
            model=self.current_model,
            messages=messages,
            system_prompt=mem.build_system_prompt(),
        )

        buffer = ""
        since  = 0
        try:
            async for chunk in oc.stream_chat(payload):
                if self._cancel:
                    break
                buffer += chunk
                since  += len(chunk)
                if since >= UPDATE_INTERVAL_CHARS:
                    md.value = buffer
                    since    = 0
                    self._pg.update()
        except oc.OllamaOfflineError as ex:
            buffer = f"**Error:** {ex}"
        except Exception as ex:
            buffer += f"\n\n**Error:** {ex}"
        finally:
            md.value = buffer
            db.add_message(self.conv_id, "assistant", buffer)
            self.streaming         = False
            self._cancel           = False
            self._send_btn.visible = True
            self._stop_btn.visible = False
            self._pg.update()
