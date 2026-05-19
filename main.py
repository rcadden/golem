import sys
import os
import traceback

_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "golem_crash.log")
sys.stderr = open(_LOG, "w", buffering=1, encoding="utf-8")

import flet as ft
import db
import ollama_client as oc
from ui.sidebar import Sidebar
from ui.chat_view import ChatView
from ui.settings import SettingsDialog

VERSION = "0.1.0"

_DARK_SCHEME = ft.ColorScheme(
    primary="#4a9eff",
    surface="#212121",
    surface_container_lowest="#1a1a1a",
    surface_container="#2a2a2a",
    surface_container_high="#303030",
    on_surface="#ececec",
    on_surface_variant="#8e8ea0",
    outline_variant="#1e1e1e",
    outline="#333333",
)

_LIGHT_SCHEME = ft.ColorScheme(
    primary="#1a7fe8",
    surface="#f5f5f5",
    surface_container_lowest="#e4e4e4",
    surface_container="#ebebeb",
    surface_container_high="#dedede",
    on_surface="#1a1a1a",
    on_surface_variant="#5a5a70",
    outline_variant="#cccccc",
    outline="#aaaaaa",
)


async def main(page: ft.Page):
    try:
        await _main(page)
    except Exception:
        traceback.print_exc()
        raise


async def _main(page: ft.Page):
    page.title = "Golem"
    saved_w = int(db.get_setting("window_width", "1200"))
    saved_h = int(db.get_setting("window_height", "800"))
    page.window.width  = saved_w
    page.window.height = saved_h
    page.window.min_width  = 800
    page.window.min_height = 600
    page.padding    = 0
    page.theme_mode = ft.ThemeMode.DARK if db.get_setting("theme", "dark") == "dark" else ft.ThemeMode.LIGHT
    page.theme      = ft.Theme(color_scheme=_LIGHT_SCHEME, font_family="Segoe UI")
    page.dark_theme = ft.Theme(color_scheme=_DARK_SCHEME,  font_family="Segoe UI")
    page.bgcolor    = ft.Colors.SURFACE

    db.init_db()

    # ── Startup splash ────────────────────────────────────────────────────────
    page.add(ft.Container(
        content=ft.Row(
            [ft.ProgressRing(width=16, height=16, stroke_width=2),
             ft.Text("Starting Ollama…", size=14, color=ft.Colors.ON_SURFACE_VARIANT)],
            alignment=ft.MainAxisAlignment.CENTER,
            vertical_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=10,
        ),
        bgcolor=ft.Colors.SURFACE,
        alignment=ft.Alignment(0, 0),
        expand=True,
    ))
    page.update()

    ollama_ready = await oc.ensure_ollama_running()
    models        = await oc.list_models() if ollama_ready else []

    page.controls.clear()

    default_model: list[str] = [db.get_setting("default_model", models[0] if models else "")]
    if not default_model[0] and models:
        default_model[0] = models[0]

    current_conv_id:  list[int | None] = [None]
    sidebar_visible:  list[bool]        = [True]

    # ── Chat area ─────────────────────────────────────────────────────────────
    chat_container = ft.Container(expand=True, bgcolor=ft.Colors.SURFACE)

    def empty_state() -> ft.Container:
        if not models:
            body = ft.Column(
                controls=[
                    ft.Icon(ft.Icons.WARNING_AMBER_ROUNDED, size=48, color=ft.Colors.ORANGE_400),
                    ft.Text("Couldn't start Ollama", size=20, weight=ft.FontWeight.BOLD,
                            color=ft.Colors.ON_SURFACE),
                    ft.Text(
                        "Run `ollama serve` in a terminal, then restart Golem.",
                        size=14, color=ft.Colors.ON_SURFACE_VARIANT,
                        text_align=ft.TextAlign.CENTER,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                alignment=ft.MainAxisAlignment.CENTER,
                spacing=12,
            )
        else:
            body = ft.Column(
                controls=[
                    ft.Text("How can I help?", size=28, weight=ft.FontWeight.W_300,
                            color=ft.Colors.ON_SURFACE),
                    ft.Text(
                        "Start a new conversation or select one from the sidebar.",
                        size=14, color=ft.Colors.ON_SURFACE_VARIANT,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                alignment=ft.MainAxisAlignment.CENTER,
                spacing=8,
            )
        return ft.Container(content=body, bgcolor=ft.Colors.SURFACE,
                            alignment=ft.Alignment(0, 0), expand=True)

    chat_container.content = empty_state()

    # ── Sidebar toggle ────────────────────────────────────────────────────────
    def toggle_sidebar(e=None):
        sidebar_visible[0] = not sidebar_visible[0]
        sidebar.visible      = sidebar_visible[0]
        sidebar_stub.visible = not sidebar_visible[0]
        page.update()

    sidebar_stub = ft.Container(
        width=44,
        bgcolor=ft.Colors.SURFACE_CONTAINER_LOWEST,
        border=ft.Border.only(right=ft.BorderSide(1, ft.Colors.OUTLINE_VARIANT)),
        content=ft.Column(
            controls=[
                ft.Container(
                    content=ft.IconButton(
                        icon=ft.Icons.MENU,
                        icon_color=ft.Colors.ON_SURFACE_VARIANT,
                        icon_size=18,
                        tooltip="Show sidebar",
                        on_click=toggle_sidebar,
                    ),
                    padding=ft.Padding.only(top=8, left=2),
                ),
            ],
        ),
        visible=False,
    )

    # ── Sidebar ───────────────────────────────────────────────────────────────
    sidebar = Sidebar(
        page=page,
        on_select=lambda cid: page.run_task(load_conversation, cid),
        on_new_chat=lambda: page.run_task(new_chat),
        on_settings=lambda: open_settings(),
        on_toggle=toggle_sidebar,
    )
    sidebar.refresh()

    # ── Layout ────────────────────────────────────────────────────────────────
    page.add(ft.Row(
        controls=[sidebar_stub, sidebar, chat_container],
        spacing=0,
        expand=True,
        vertical_alignment=ft.CrossAxisAlignment.STRETCH,
    ))

    # ── Actions ───────────────────────────────────────────────────────────────
    async def new_chat():
        if not models:
            return
        model   = db.get_setting("default_model", default_model[0])
        conv_id = db.create_conversation("New Chat", model)
        current_conv_id[0] = conv_id
        sidebar.refresh(conv_id)
        view = ChatView(page, conv_id, model, models)
        chat_container.content = view
        page.update()
        view._input.focus()
        page.update()

    async def load_conversation(conv_id: int):
        current_conv_id[0] = conv_id
        conv  = db.get_conversation(conv_id)
        model = conv["model"] if conv else default_model[0]
        if model not in models and models:
            model = models[0]
        sidebar.set_active(conv_id)
        view = ChatView(page, conv_id, model, models)
        view.load_history()
        chat_container.content = view
        page.update()

    def open_settings():
        dlg = SettingsDialog(page=page, models=models, on_save=on_settings_save)
        page.show_dialog(dlg)

    def on_settings_save(new_model: str, new_theme: str):
        if new_model:
            default_model[0] = new_model
        if new_theme:
            page.theme_mode = ft.ThemeMode.DARK if new_theme == "dark" else ft.ThemeMode.LIGHT
        page.update()

    def on_resize(e: ft.PageResizeEvent):
        db.set_setting("window_width",  str(int(page.window.width)))
        db.set_setting("window_height", str(int(page.window.height)))

    page.on_resize = on_resize

    convs = db.list_conversations()
    if convs:
        await load_conversation(convs[0]["id"])

    page.update()


ft.run(main)
