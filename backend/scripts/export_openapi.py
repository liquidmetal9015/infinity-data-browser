import json
import os

from app.main import app


def export_schema() -> None:
    schema = app.openapi()
    output_path = os.path.join(os.path.dirname(__file__), "..", "openapi.json")

    with open(output_path, "w") as f:
        json.dump(schema, f, indent=2)

    print(f"✅ Successfully exported OpenAPI schema to {output_path}")


if __name__ == "__main__":
    export_schema()
