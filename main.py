import flet as ft
import asyncio
import db
import ollama_client as oc
from ui.sidebar import Sidebar
from ui.chat_view import ChatView
from ui.settings import SettingsDialog

VERSION = "0.1.0"


async def main(page: ft.Page):
    # ── Window setup ──────────────────────────────────────────────────────────
    page.title = "Golem"
    saved_w = int(db.get_setting("window_width", "1200"))
    saved_h = int(db.get_setting("window_height", "800"))
    page.window.width = saved_w
    page.window.height = saved_h
    page.window.min_width = 800
    page.window.min_height = 600

    saved_theme = db.get_setting("theme", "dark")
    page.theme_mode = ft.ThemeMode.DARK if saved_theme == "dark" else ft.ThemeMode.LIGHT
    page.padding = 0
    page.fonts = {"Cascadia Code": "https://raw.githubusercontent.com/microsoft/cascadia-code/main/fonts/otf/CascadiaCode.otf"}
    page.theme = ft.Theme(font_family="Segoe UI")

    # ── State ─────────────────────────────────────────────────────────────────
    db.init_db()
    models = await oc.list_models()
    default_model = db.get_setting("default_model", models[0] if models else "")
    if not default_model and models:
        default_model = models[0]

    current_conv_id: list[int | None] = [None]
    sidebar_visible: list[bool] = [True]

    # ── Chat area placeholder ─────────────────────────────────────────────────
    chat_container = ft.Container(expand=True)

    def empty_state() -> ft.Container:
        if not models:
            return ft.Container(
                content=ft.Column(
                    controls=[
                        ft.Icon(ft.Icons.WARNING_AMBER_ROUNDED, size=48, color=ft.Colors.ORANGE_400),
                        ft.Text("Ollama is not running", size=20, weight=ft.FontWeight.BOLD),
                        ft.Text(
                            "Start it with `ollama serve` or ensure the Ollama service is active.",
                            size=14,
                            color=ft.Colors.with_opacity(0.6, ft.Colors.WHITE),
                            text_align=ft.TextAlign.CENTER,
                        ),
                    ],
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    alignment=ft.MainAxisAlignment.CENTER,
                    spacing=12,
                ),
                alignment=ft.alignment.center,
                expand=True,
            )
        return ft.Container(
            content=ft.Column(
                controls=[
                    ft.Text("How can I help?", size=28, weight=ft.FontWeight.W_300),
                    ft.Text(
                        "Start a new conversation or select one from the sidebar.",
                        size=14,
                        color=ft.Colors.with_opacity(0.4, ft.Colors.WHITE),
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                alignment=ft.MainAxisAlignment.CENTER,
                spacing=8,
            ),
            alignment=ft.alignment.center,
            expand=True,
        )

    chat_container.content = empty_state()

    # ── Model picker ──────────────────────────────────────────────────────────
    model_options = [ft.dropdown.Option(m) for m in models] if models else [ft.dropdown.Option("No models found")]
    model_picker = ft.Dropdown(
        value=default_model or (models[0] if models else None),
        options=model_options,
        on_change=None,  # wired below
        border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
        focused_border_color=ft.Colors.BLUE_400,
        text_size=13,
        dense=True,
        content_padding=ft.padding.symmetric(horizontal=10, vertical=4),
        width=220,
        disabled=not models,
    )

    def get_current_model() -> str:
        return model_picker.value or default_model or ""

    def on_model_change(e):
        if current_conv_id[0] is not None:
            # Update the model on the current conversation's chat view
            if isinstance(chat_container.content, ChatView):
                chat_container.content.current_model = model_picker.value

    model_picker.on_change = on_model_change

    # ── Sidebar ───────────────────────────────────────────────────────────────
    sidebar = Sidebar(
        page=page,
        on_select=lambda cid: asyncio.ensure_future(load_conversation(cid)),
        on_new_chat=lambda: asyncio.ensure_future(new_chat()),
        on_settings=lambda: open_settings(),
    )
    sidebar.refresh()

    # ── Top bar ───────────────────────────────────────────────────────────────
    def toggle_sidebar(e):
        sidebar_visible[0] = not sidebar_visible[0]
        sidebar.visible = sidebar_visible[0]
        page.update()

    settings_btn = ft.IconButton(
        icon=ft.Icons.SETTINGS_OUTLINED,
        icon_color=ft.Colors.with_opacity(0.7, ft.Colors.WHITE),
        tooltip="Settings",
        on_click=lambda _: open_settings(),
    )

    topbar = ft.Container(
        content=ft.Row(
            controls=[
                ft.IconButton(
                    icon=ft.Icons.MENU,
                    icon_color=ft.Colors.with_opacity(0.7, ft.Colors.WHITE),
                    tooltip="Toggle sidebar",
                    on_click=toggle_sidebar,
                ),
                ft.Text("Golem", size=16, weight=ft.FontWeight.W_600),
                ft.Container(expand=True),
                model_picker,
                settings_btn,
            ],
            vertical_alignment=ft.CrossAxisAlignment.CENTER,
        ),
        bgcolor=ft.Colors.with_opacity(0.04, ft.Colors.WHITE),
        border=ft.border.only(bottom=ft.BorderSide(1, ft.Colors.with_opacity(0.08, ft.Colors.WHITE))),
        padding=ft.padding.symmetric(horizontal=8, vertical=4),
        height=48,
    )

    # ── Layout ────────────────────────────────────────────────────────────────
    main_row = ft.Row(
        controls=[sidebar, chat_container],
        spacing=0,
        expand=True,
        vertical_alignment=ft.CrossAxisAlignment.STRETCH,
    )

    page.add(
        ft.Column(
            controls=[topbar, main_row],
            spacing=0,
            expand=True,
        )
    )

    # ── Actions ───────────────────────────────────────────────────────────────
    async def new_chat():
        if not models:
            return
        conv_id = db.create_conversation("New Chat", get_current_model())
        current_conv_id[0] = conv_id
        sidebar.refresh(conv_id)
        view = ChatView(page, conv_id, get_current_model())
        chat_container.content = view
        await page.update_async()
        view._input.focus()
        await page.update_async()

    async def load_conversation(conv_id: int):
        current_conv_id[0] = conv_id
        conv = db.get_conversation(conv_id)
        model = conv["model"] if conv else get_current_model()
        if model not in models and models:
            model = models[0]
        model_picker.value = model
        sidebar.set_active(conv_id)
        view = ChatView(page, conv_id, model)
        view.load_history()
        chat_container.content = view
        await page.update_async()

    def open_settings():
        dlg = SettingsDialog(
            page=page,
            models=models,
            on_save=on_settings_save,
        )
        page.overlay.append(dlg)
        dlg.open = True
        page.update()

    def on_settings_save(new_model: str, new_theme: str):
        if new_model:
            model_picker.value = new_model
        page.update()

    # ── Window resize persistence ─────────────────────────────────────────────
    def on_resize(e: ft.WindowResizeEvent):
        db.set_setting("window_width", str(int(page.window.width)))
        db.set_setting("window_height", str(int(page.window.height)))

    page.on_resized = on_resize

    # ── Startup: restore last conversation or show empty state ────────────────
    convs = db.list_conversations()
    if convs:
        await load_conversation(convs[0]["id"])
    # else leave empty state

    await page.update_async()


ft.app(target=main)
