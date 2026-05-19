import flet as ft
import db
from datetime import datetime, timezone

SIDEBAR_BG   = ft.Colors.SURFACE_CONTAINER_LOWEST
TEXT_PRIMARY = ft.Colors.ON_SURFACE
TEXT_MUTED   = ft.Colors.ON_SURFACE_VARIANT
ACCENT       = ft.Colors.PRIMARY
BORDER       = ft.Colors.OUTLINE_VARIANT


def _group_label(label: str) -> ft.Container:
    return ft.Container(
        content=ft.Text(label, size=11, color=ft.Colors.ON_SURFACE_VARIANT,
                        weight=ft.FontWeight.W_600),
        padding=ft.Padding.only(left=16, top=14, bottom=2),
    )


def _date_group(conv_date: datetime) -> str:
    now   = datetime.now(timezone.utc)
    delta = (now.date() - conv_date.date()).days
    if delta == 0:  return "Today"
    if delta == 1:  return "Yesterday"
    if delta <= 7:  return "Previous 7 Days"
    if delta <= 30: return "Previous 30 Days"
    return "Older"


class Sidebar(ft.Container):
    def __init__(self, page: ft.Page, on_select, on_new_chat, on_settings, on_toggle):
        super().__init__(
            width=280,
            bgcolor=SIDEBAR_BG,
            border=ft.Border.only(right=ft.BorderSide(1, BORDER)),
        )
        self._pg         = page
        self.on_select   = on_select
        self.on_new_chat = on_new_chat
        self.on_settings = on_settings
        self.on_toggle   = on_toggle
        self.active_conv_id: int | None = None
        self._items: dict[int, ft.Container] = {}

        # ── Header ────────────────────────────────────────────────────────────
        header = ft.Container(
            content=ft.Row(
                controls=[
                    ft.Text("Golem", size=14, weight=ft.FontWeight.W_600,
                            color=TEXT_PRIMARY),
                    ft.Container(expand=True),
                    ft.IconButton(
                        icon=ft.Icons.MENU,
                        icon_color=TEXT_MUTED,
                        icon_size=17,
                        tooltip="Collapse sidebar",
                        on_click=lambda _: on_toggle(),
                        style=ft.ButtonStyle(
                            overlay_color=ft.Colors.with_opacity(0.06, ft.Colors.ON_SURFACE),
                        ),
                    ),
                ],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            padding=ft.Padding.only(left=16, right=6, top=10, bottom=10),
        )

        # ── New Chat ──────────────────────────────────────────────────────────
        new_chat_btn = ft.Container(
            content=ft.Row(
                controls=[
                    ft.Icon(ft.Icons.EDIT_OUTLINED, size=14, color=TEXT_MUTED),
                    ft.Text("New Chat", size=13, color=TEXT_PRIMARY),
                ],
                spacing=8,
                tight=True,
            ),
            padding=ft.Padding.symmetric(horizontal=16, vertical=9),
            border_radius=ft.BorderRadius.all(7),
            on_click=lambda _: on_new_chat(),
        )

        # ── Conversation list ─────────────────────────────────────────────────
        self._list_col = ft.Column(
            controls=[],
            spacing=0,
            scroll=ft.ScrollMode.AUTO,
            expand=True,
        )

        # ── Settings (bottom) ─────────────────────────────────────────────────
        settings_row = ft.Container(
            content=ft.Row(
                controls=[
                    ft.Icon(ft.Icons.SETTINGS_OUTLINED, size=14, color=TEXT_MUTED),
                    ft.Text("Settings", size=13, color=TEXT_MUTED),
                ],
                spacing=8,
                tight=True,
            ),
            padding=ft.Padding.symmetric(horizontal=16, vertical=10),
            border=ft.Border.only(top=ft.BorderSide(1, BORDER)),
            on_click=lambda _: on_settings(),
        )

        self.content = ft.Column(
            controls=[
                header,
                ft.Container(
                    content=new_chat_btn,
                    padding=ft.Padding.symmetric(horizontal=8, vertical=2),
                ),
                ft.Container(content=self._list_col, expand=True,
                             padding=ft.Padding.only(top=4)),
                settings_row,
            ],
            spacing=0,
            expand=True,
        )

    # ── Public ────────────────────────────────────────────────────────────────

    def refresh(self, active_id: int | None = None):
        if active_id is not None:
            self.active_conv_id = active_id
        self._list_col.controls.clear()
        self._items.clear()

        convs = db.list_conversations()
        if not convs:
            self._list_col.controls.append(ft.Container(
                content=ft.Text("No conversations yet", size=12,
                                color=ft.Colors.ON_SURFACE_VARIANT),
                padding=ft.Padding.symmetric(horizontal=16, vertical=12),
            ))
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

    def set_active(self, conv_id: int):
        old_id = self.active_conv_id
        self.active_conv_id = conv_id

        if old_id and old_id in self._items:
            old = self._items[old_id]
            old.content.controls[0].content.bgcolor = ft.Colors.TRANSPARENT
            old.content.controls[1].color = TEXT_MUTED

        if conv_id in self._items:
            new = self._items[conv_id]
            new.content.controls[0].content.bgcolor = ACCENT
            new.content.controls[1].color = TEXT_PRIMARY

    # ── Private ───────────────────────────────────────────────────────────────

    def _make_item(self, conv) -> ft.Container:
        is_active = conv["id"] == self.active_conv_id

        dot = ft.Container(
            content=ft.Container(
                width=5, height=5,
                border_radius=ft.BorderRadius.all(3),
                bgcolor=ACCENT if is_active else ft.Colors.TRANSPARENT,
            ),
            width=16,
            alignment=ft.Alignment(0, 0),
        )

        title = ft.Text(
            conv["title"],
            size=13,
            overflow=ft.TextOverflow.ELLIPSIS,
            max_lines=1,
            color=TEXT_PRIMARY if is_active else TEXT_MUTED,
            expand=True,
        )

        menu = ft.PopupMenuButton(
            icon=ft.Icons.MORE_HORIZ,
            icon_size=14,
            icon_color=ft.Colors.ON_SURFACE_VARIANT,
            tooltip="Options",
            items=[
                ft.PopupMenuItem(
                    content="Rename",
                    on_click=lambda _, cid=conv["id"], ct=conv["title"]: self._on_rename(cid, ct),
                ),
                ft.PopupMenuItem(
                    content="Delete",
                    on_click=lambda _, cid=conv["id"]: self._on_delete(cid),
                ),
            ],
        )

        return ft.Container(
            content=ft.Row(
                controls=[dot, title, menu],
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            padding=ft.Padding.symmetric(horizontal=8, vertical=4),
            border_radius=ft.BorderRadius.all(6),
            on_click=lambda _, cid=conv["id"]: self.on_select(cid),
        )

    def _on_rename(self, conv_id: int, current_title: str):
        field = ft.TextField(value=current_title, autofocus=True)

        def do_rename(e):
            title = field.value.strip()
            if title:
                db.rename_conversation(conv_id, title)
            self._pg.pop_dialog()
            self.refresh(self.active_conv_id)
            self._pg.update()

        self._pg.show_dialog(ft.AlertDialog(
            title=ft.Text("Rename Conversation"),
            content=field,
            actions=[
                ft.TextButton(content="Cancel", on_click=lambda _: self._pg.pop_dialog()),
                ft.ElevatedButton(content="Rename", on_click=do_rename),
            ],
        ))

    def _on_delete(self, conv_id: int):
        def confirm(e):
            db.delete_conversation(conv_id)
            self._pg.pop_dialog()
            was_active = self.active_conv_id == conv_id
            self.refresh()
            self._pg.update()
            if was_active:
                self.on_new_chat()

        self._pg.show_dialog(ft.AlertDialog(
            title=ft.Text("Delete Conversation?"),
            content=ft.Text("This cannot be undone."),
            actions=[
                ft.TextButton(content="Cancel", on_click=lambda _: self._pg.pop_dialog()),
                ft.ElevatedButton(
                    content="Delete",
                    on_click=confirm,
                    style=ft.ButtonStyle(bgcolor=ft.Colors.RED_700),
                ),
            ],
        ))
