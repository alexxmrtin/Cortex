from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.Core.database import get_db
from app.Models.Usuario import Usuario
from app.Schemas.UsuarioSchema import UsuarioCrear, UsuarioLogin, UsuarioRespuesta, UsuarioActualizar
# from app.Core.security import hashear_contrasena, verificar_contrasena, crear_token  # TODO: crear security.py

router = APIRouter()


@router.post("/registro", response_model=UsuarioRespuesta)
def registro(datos: UsuarioCrear, db: Session = Depends(get_db)):
    pass


@router.post("/login")
def login(datos: UsuarioLogin, db: Session = Depends(get_db)):
    pass


@router.get("/me", response_model=UsuarioRespuesta)
def obtener_usuario():
    pass


@router.patch("/me", response_model=UsuarioRespuesta)
def actualizar_usuario(datos: UsuarioActualizar, db: Session = Depends(get_db)):
    pass


@router.delete("/me")
def eliminar_usuario(db: Session = Depends(get_db)):
    pass
