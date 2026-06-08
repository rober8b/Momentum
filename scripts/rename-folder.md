# Instrucciones para renombrar la carpeta local y el repo en GitHub

Hacer esto DESPUÉS de mergear el branch `feat/rebrand-completion` y cerrar Claude Code.

---

## 1. Renombrar la carpeta local

Desde una terminal en `C:\Users\rober\WEB_WORKSPACE`:

```bash
cd C:\Users\rober\WEB_WORKSPACE

# Verificar que el árbol está limpio antes de renombrar
git -C command-center status

# Opción A — desde Git Bash / WSL
mv command-center momentum

# Opción B — desde PowerShell
Rename-Item command-center momentum

# Verificar que git sigue funcionando
cd momentum
git status
git log --oneline -3
```

---

## 2. Renombrar el repo en GitHub

1. Ir a **https://github.com/rober8b/-command-center/settings**
2. Sección "General" → campo **Repository name** → cambiar a `Momentum`
3. Click **Rename**

GitHub redirigirá automáticamente las URLs del repo viejo al nuevo.

---

## 3. Actualizar el remote local

Después de renombrar en GitHub, desde la carpeta `momentum`:

```bash
git remote set-url origin https://github.com/rober8b/Momentum.git

# Verificar
git remote -v

# Push para confirmar que el remote nuevo funciona
git push
```

---

## 4. Actualizar el remote SSH (si usás SSH en lugar de HTTPS)

```bash
git remote set-url origin git@github.com:rober8b/Momentum.git
```

---

## 5. Verificación final

```bash
git status        # árbol limpio
git log --oneline -5   # commits OK
npm run typecheck # 0 errores
```
