import flet as ft
import db
from datetime import datetime, timezone


def _group_label(label: str) -> ft.Container:
    return ft.Container(
        content=ft.Text(label, size=11, color=ft.Colors.with_opacity(0.4, ft.Colors.WHITE), weight=ft.FontWeight.W_600),
        padding=ft.padding.only(left=8, top=12, bottom=4),
    )


def _date_group(conv_date: datetime) -> str:
    now = datetime.now(timezone.utc)
    delta = (now.date() - conv_date.date()).days
    if delta == 0:
        return "Today"
    if delta == 1:
        return "Yesterday"
    if delta <= 7:
        return "Previous 7 Days"
    if delta <= 30:
        return "Previous 30 Days"
    return "Older"


class Sidebar(ft.Container):
    def __init__(self, page: ft.Page, on_select, on_new_chat, on_settings):
        super().__init__(
            width=260,
            bgcolor=ft.Colors.with_opacity(0.04, ft.Colors.WHITE),
            border=ft.border.only(right=ft.BorderSide(1, ft.Colors.with_opacity(0.08, ft.Colors.WHITE))),
        )
        self.page = page
        self.on_select = on_select
        self.on_new_chat = on_new_chat
        self.on_settings = on_settings
        self.active_conv_id: int | None = None
        self._items: dict[int, ft.Container] = {}

        new_chat_btn = ft.ElevatedButton(
            "+ New Chat",
            on_click=lambda _: on_new_chat(),
            style=ft.ButtonStyle(
                bgcolor=ft.Colors.BLUE_700,
                color=ft.Colors.WHITE,
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=ft.padding.symmetric(horizontal=16, vertical=10),
            ),
            width=230,
        )

        self._list_col = ft.Column(
            controls=[],
            spacing=0,
            scroll=ft.ScrollMode.AUTO,
            expand=True,
        )

        self.content = ft.Column(
            controls=[
                ft.Container(content=new_chat_btn, padding=ft.padding.all(12)),
                ft.Divider(height=1, color=ft.Colors.with_opacity(0.08, ft.Colors.WHITE)),
                ft.Container(content=self._list_col, expand=True, padding=ft.padding.only(bottom=8)),
            ],
            spacing=0,
            expand=True,
        )

    def refresh(self, active_id: int | None = None):
        if active_id is not None:
            self.active_conv_id = active_id
        self._list_col.controls.clear()
        self._items.clear()

        convs = db.list_conversations()
        if not convs:
            self._list_col.controls.append(
                ft.Container(
                    content=ft.Text("No conversations yet", size=12, color=ft.Colors.with_opacity(0.3, ft.Colors.WHITE)),
                    padding=ft.padding.all(16),
                )
            )
            return

        current_group = None
        for conv in convs:
            try:
                conv_dt = datetime.fromisoformat(conv["updated_at"]).replace(tzinfo=timezone.utc)
            except Exception:
                conv_dt = datetime.now(timezone.utc)

            group = _date_group(conv_dt)
            if group != current_group:
                current_group = group
                self._list_col.controls.append(_group_label(group))

            item = self._make_item(conv)
            self._items[conv["id"]] = item
            self._list_col.controls.append(item)

    def _make_item(self, conv) -> ft.Container:
        is_active = conv["id"] == self.active_conv_id

        title_text = ft.Text(
            conv["title"],
            size=13,
            overflow=ft.TextOverflow.ELLIPSIS,
            max_lines=1,
            color=ft.Colors.WHITE if is_active else ft.Colors.with_opacity(0.75, ft.Colors.WHITE),
            expand=True,
        )

        more_btn = ft.PopupMenuButton(
            icon=ft.Icons.MORE_HORIZ,
            icon_size=16,
            icon_color=ft.Colors.with_opacity(0.4, ft.Colors.WHITE),
            tooltip="Options",
            items=[
                ft.PopupMenuItem(text="Rename", on_click=lambda _, cid=conv["id"], ct=conv["title"]: self._on_rename(cid, ct)),
                ft.PopupMenuItem(text="Delete", on_click=lambda _, cid=conv["id"]: self._on_delete(cid)),
            ],
        )

        container = ft.Container(
            content=ft.Row(
                controls=[title_text, more_btn],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            bgcolor=ft.Colors.with_opacity(0.12, ft.Colors.WHITE) if is_active else ft.Colors.TRANSPARENT,
            border_radius=ft.border_radius.all(8),
            padding=ft.padding.symmetric(horizontal=10, vertical=8),
            margin=ft.margin.symmetric(horizontal=6, vertical=1),
            on_click=lambda _, cid=conv["id"]: self.on_select(cid),
        )

        return container

    def set_active(self, conv_id: int):
        old_id = self.active_conv_id
        self.active_conv_id = conv_id
        if old_id and old_id in self._items:
            old_item = self._items[old_id]
            old_item.bgcolor = ft.Colors.TRANSPARENT
            title = old_item.content.controls[0]
            title.color = ft.Colors.with_opacity(0.75, ft.Colors.WHITE)
        if conv_id in self._items:
            new_item = self._items[conv_id]
            new_item.bgcolor = ft.Colors.with_opacity(0.12, ft.Colors.WHITE)
            title = new_item.content.controls[0]
            title.color = ft.Colors.WHITE

    def _on_rename(self, conv_id: int, current_title: str):
        field = ft.TextField(value=current_title, autofocus=True)

        def do_rename(e):
            new_title = field.value.strip()
            if new_title:
                db.rename_conversation(conv_id, new_title)
            dlg.open = False
            self.page.update()
            self.refresh()
            self.page.update()

        dlg = ft.AlertDialog(
            title=ft.Text("Rename Conversation"),
            content=field,
            actions=[
                ft.TextButton("Cancel", on_click=lambda _: self._close_dlg(dlg)),
                ft.ElevatedButton("Rename", on_click=do_rename),
            ],
        )
        self.page.overlay.append(dlg)
        dlg.open = True
        self.page.update()

    def _on_delete(self, conv_id: int):
        def confirm(e):
            db.delete_conversation(conv_id)
            dlg.open = False
            self.page.update()
            self.refresh()
            self.page.update()
            if self.active_conv_id == conv_id:
                self.on_new_chat()

        dlg = ft.AlertDialog(
            title=ft.Text("Delete Conversation?"),
            content=ft.Text("This cannot be undone."),
            actions=[
                ft.TextButton("Cancel", on_click=lambda _: self._close_dlg(dlg)),
                ft.ElevatedButton("Delete", on_click=confirm, style=ft.ButtonStyle(bgcolor=ft.Colors.RED_700)),
            ],
        )
        self.page.overlay.append(dlg)
        dlg.open = True
        self.page.update()

    def _close_dlg(self, dlg: ft.AlertDialog):
        dlg.open = False
        self.page.update()
