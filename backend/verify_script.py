import asyncio

from httpx import ASGITransport, AsyncClient

from app.auth import get_current_user, get_current_user_id
from app.main import app
from app.models.user import User


async def override_get_current_user_id() -> str:
    return "test-user-async"


async def override_get_current_user() -> User:
    return User(id="test-user-async", email="async@example.com")


app.dependency_overrides[get_current_user_id] = override_get_current_user_id
app.dependency_overrides[get_current_user] = override_get_current_user


async def run_verification() -> None:
    from app.database import async_session_factory

    print("Pre-provisioning mock user...")
    async with async_session_factory() as session:
        user = await session.get(User, "test-user-async")
        if not user:
            session.add(User(id="test-user-async", email="async@example.com"))
            await session.commit()

    print("Testing ArmyList CRUD Endpoints (Native Async)...")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("0. Fetching a valid faction ID...")
        faction_resp = await client.get("/api/factions")
        faction_id = faction_resp.json()[0]["id"]
        print(f"   Using faction_id: {faction_id}")

        print("1. Creating list...")
        resp = await client.post(
            "/api/lists",
            json={
                "name": "My Verification List",
                "faction_id": faction_id,
                "points": 300,
                "swc": 6.0,
                "units_json": {"test": "data"},
            },
        )
        print("   Result:", resp.status_code, resp.json())
        list_id = resp.json().get("id")

        if list_id:
            print(f"\n2. Fetching list {list_id}...")
            resp = await client.get(f"/api/lists/{list_id}")
            print("   Result:", resp.status_code, resp.json())

            print("\n3. Updating list...")
            resp = await client.put(
                f"/api/lists/{list_id}",
                json={
                    "name": "Updated Verification List",
                    "faction_id": faction_id,
                    "points": 298,
                    "swc": 5.5,
                    "units_json": {"test": "data_updated"},
                },
            )
            print("   Result:", resp.status_code, resp.json())

            print("\n4. Getting all user lists...")
            resp = await client.get("/api/lists")
            print("   Result:", resp.status_code, len(resp.json()), "lists found")

            print("\n5. Deleting list...")
            resp = await client.delete(f"/api/lists/{list_id}")
            print("   Result:", resp.status_code)

    print("\nVerification Complete.")


if __name__ == "__main__":
    asyncio.run(run_verification())
