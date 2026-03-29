from helpers import slugify


class Greeter:
    def greet(self, name: str) -> str:
        return f"Hello, {name}"


def build_message(name: str) -> str:
    return slugify(name)
