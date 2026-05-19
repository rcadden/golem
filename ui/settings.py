import flet as ft
import db
import memory as mem


class SettingsDialog(ft.AlertDialog):
    def __init__(self, page: ft.Page, models: list[str], on_save):
        super().__init__(
            title=ft.Text("Settings"),
            modal=True,
        )
        self.page = page
        self.models = models
        self.on_save_cb = on_save

        self._memory_field = ft.TextField(
            value=mem.load_memory(),
            multiline=True,
            min_lines=8,
            max_lines=16,
            label="Personal Memory",
            hint_text="Facts about you injected into every conversation...",
            border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
            focused_border_color=ft.Colors.BLUE_400,
        )

        current_model = db.get_setting("default_model", models[0] if models else "")
        self._model_dd = ft.Dropdown(
            label="Default Model",
            value=current_model,
            options=[ft.dropdown.Option(m) for m in models],
            border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
            focused_border_color=ft.Colors.BLUE_400,
        )

        current_theme = db.get_setting("theme", "dark")
        self._theme_dd = ft.Dropdown(
            label="Theme",
            value=current_theme,
            options=[ft.dropdown.Option("dark"), ft.dropdown.Option("light")],
            border_color=ft.Colors.with_opacity(0.2, ft.Colors.WHITE),
            focused_border_color=ft.Colors.BLUE_400,
        )

        self.content = ft.Container(
            content=ft.Column(
                controls=[
                    self._memory_field,
                    ft.Row([self._model_dd, self._theme_dd], spacing=16),
                    ft.Divider(),
                    ft.Text("About", weight=ft.FontWeight.BOLD),
                    ft.Text("Golem v0.1.0 — local Ollama chat frontend", size=12),
                    ft.Text(f"DB: {db.DB_PATH}", size=11, color=ft.Colors.with_opacity(0.5, ft.Colors.WHITE)),
                    ft.Text(f"Conversations: {db.get_conversation_count()}", size=11, color=ft.Colors.with_opacity(0.5, ft.Colors.WHITE)),
                ],
                spacing=12,
                tight=True,
                scroll=ft.ScrollMode.AUTO,
            ),
            width=560,
            padding=ft.padding.only(top=8),
        )

        self.actions = [
            ft.TextButton("Cancel", on_click=lambda _: self._close()),
            ft.ElevatedButton("Save", on_click=self._save, style=ft.ButtonStyle(bgcolor=ft.Colors.BLUE_700)),
        ]

    def _save(self, e):
        mem.save_memory(self._memory_field.value or "")
        if self._model_dd.value:
            db.set_setting("default_model", self._model_dd.value)
        if self._theme_dd.value:
            db.set_setting("theme", self._theme_dd.value)
            self.page.theme_mode = (
                ft.ThemeMode.DARK if self._theme_dd.value == "dark" else ft.ThemeMode.LIGHT
            )
        self._close()
        self.on_save_cb(self._model_dd.value, self._theme_dd.value)
        self.page.update()

    def _close(self):
        self.open = False
        self.page.update()
