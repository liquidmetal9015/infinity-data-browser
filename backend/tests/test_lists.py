import pytest
from httpx import AsyncClient

from app.main import app
from app.auth import get_current_user_id, get_current_user
from app.models.user import User

# Mock dependencies
async def mock_get_current_user_id():
    return "test-user-123"

async def mock_get_current_user():
    return User(id="test-user-123", email="test@example.com")


@pytest.fixture(autouse=True)
def override_auth_dependencies():
    app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_and_get_list(client: AsyncClient, setup_database):
    # 1. Create a list
    list_payload = {
        "name": "My Competitive List",
        "faction_id": 16, # Assuming PanOceania
        "points": 300,
        "swc": 6.0,
        "units_json": {
            "group1": [{"unit_id": 10, "option_id": 5}],
            "group2": []
        }
    }
    
    # We don't need a token header because we mocked the dependency
    response = await client.post("/api/lists", json=list_payload)
    assert response.status_code == 201
    created_list = response.json()
    assert created_list["name"] == "My Competitive List"
    assert created_list["points"] == 300
    assert "id" in created_list
    list_id = created_list["id"]

    # 2. Get the list
    response = await client.get(f"/api/lists/{list_id}")
    assert response.status_code == 200
    fetched_list = response.json()
    assert fetched_list["id"] == list_id
    assert fetched_list["units_json"]["group1"][0]["unit_id"] == 10

    # 3. Get all lists for user
    response = await client.get("/api/lists")
    assert response.status_code == 200
    lists = response.json()
    assert len(lists) >= 1
    assert any(l["id"] == list_id for l in lists)

    # 4. Update the list
    update_payload = {"name": "Updated List Name", "points": 298, "faction_id": 16}
    response = await client.put(f"/api/lists/{list_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated List Name"
    assert response.json()["points"] == 298

    # 5. Delete the list
    response = await client.delete(f"/api/lists/{list_id}")
    assert response.status_code == 204

    # 6. Verify deletion
    response = await client.get(f"/api/lists/{list_id}")
    assert response.status_code == 404
