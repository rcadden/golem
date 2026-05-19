import flet as ft


async def main(page: ft.Page):
    page.title = "Golem"
    page.window.width = 1200
    page.window.height = 800
    page.window.min_width = 800
    page.window.min_height = 600
    page.theme_mode = ft.ThemeMode.DARK
    page.padding = 0

    page.add(
        ft.Container(
            content=ft.Text("Golem", size=32, weight=ft.FontWeight.BOLD),
            alignment=ft.alignment.center,
            expand=True,
        )
    )


ft.app(target=main)
