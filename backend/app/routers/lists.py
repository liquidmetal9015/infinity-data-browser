from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.database import get_session
from app.auth import get_current_user_id
from app.models.army_list import ArmyList
from app.schemas.army_list import (
    ArmyListCreate,
    ArmyListUpdate,
    ArmyListSummaryResponse,
    ArmyListDetailResponse,
)

router = APIRouter(prefix="/api/lists", tags=["Lists"])

@router.get("", response_model=List[ArmyListSummaryResponse])
async def get_user_lists(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
):
    """Get all saved army lists for the authenticated user."""
    result = await db.execute(
        select(ArmyList)
        .where(ArmyList.user_id == user_id)
        .order_by(ArmyList.updated_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=ArmyListDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    list_in: ArmyListCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
):
    """Create a new army list for the user."""
    new_list = ArmyList(
        user_id=user_id,
        name=list_in.name,
        faction_id=list_in.faction_id,
        points=list_in.points,
        swc=list_in.swc,
        units_json=list_in.units_json
    )
    db.add(new_list)
    await db.commit()
    await db.refresh(new_list)
    return new_list

@router.get("/{list_id}", response_model=ArmyListDetailResponse)
async def get_list(
    list_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
):
    """Get details of a specific army list."""
    result = await db.execute(
        select(ArmyList).where(ArmyList.id == list_id).where(ArmyList.user_id == user_id)
    )
    army_list = result.scalars().first()
    if not army_list:
        raise HTTPException(status_code=404, detail="List not found")
    return army_list

@router.put("/{list_id}", response_model=ArmyListDetailResponse)
async def update_list(
    list_id: int,
    list_in: ArmyListUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
):
    """Update an existing army list."""
    result = await db.execute(
        select(ArmyList).where(ArmyList.id == list_id).where(ArmyList.user_id == user_id)
    )
    army_list = result.scalars().first()
    if not army_list:
        raise HTTPException(status_code=404, detail="List not found")
    
    update_data = list_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(army_list, key, value)
        
    await db.commit()
    await db.refresh(army_list)
    return army_list

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
):
    """Delete an army list."""
    result = await db.execute(
        select(ArmyList).where(ArmyList.id == list_id).where(ArmyList.user_id == user_id)
    )
    army_list = result.scalars().first()
    if not army_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    await db.delete(army_list)
    await db.commit()
    return None
