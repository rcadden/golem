import webbrowser
import flet as ft


def message_bubble(role: str, content: str, on_copy=None) -> ft.Container:
    """Single chat message bubble — user (right) or assistant (left)."""
    is_user = role == "user"

    if is_user:
        msg_content = ft.Text(
            content,
            selectable=True,
            color=ft.Colors.WHITE,
            size=14,
        )
    else:
        msg_content = ft.Markdown(
            content,
            selectable=True,
            extension_set=ft.MarkdownExtensionSet.GITHUB_WEB,
            code_theme="atom-one-dark",
            code_style_sheet=ft.MarkdownStyleSheet(code_text_style=ft.TextStyle(font_family="Cascadia Code, Consolas, monospace")),
            on_tap_link=lambda e: webbrowser.open(e.data),
        )

    copy_btn = ft.IconButton(
        icon=ft.Icons.COPY_OUTLINED,
        icon_size=14,
        icon_color=ft.Colors.with_opacity(0.5, ft.Colors.WHITE),
        tooltip="Copy",
        on_click=lambda _: on_copy(content) if on_copy else None,
        style=ft.ButtonStyle(padding=ft.Padding.all(4)),
        visible=True,
    )

    bubble = ft.Container(
        content=ft.Column(
            controls=[msg_content, ft.Row([copy_btn], alignment=ft.MainAxisAlignment.END)],
            spacing=2,
            tight=True,
        ),
        bgcolor=ft.Colors.with_opacity(0.15, ft.Colors.WHITE) if is_user else ft.Colors.with_opacity(0.06, ft.Colors.WHITE),
        border_radius=ft.BorderRadius.all(12),
        padding=ft.Padding.symmetric(horizontal=16, vertical=12),
        width=None,
    )

    return ft.Row(
        controls=[
            ft.Container(expand=True) if is_user else ft.Container(width=8),
            ft.Container(content=bubble, expand=not is_user, width=600 if is_user else None),
            ft.Container(width=8) if is_user else ft.Container(expand=True),
        ],
        vertical_alignment=ft.CrossAxisAlignment.START,
    )


def model_dropdown(models: list[str], current: str, on_change) -> ft.Dropdown:
    return ft.Dropdown(
        value=current,
        options=[ft.dropdown.Option(key=m, text=m) for m in models],
        on_select=on_change,
        border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
        focused_border_color=ft.Colors.BLUE_400,
        text_size=13,
        dense=True,
        content_padding=ft.Padding.symmetric(horizontal=10, vertical=4),
        width=220,
    )
