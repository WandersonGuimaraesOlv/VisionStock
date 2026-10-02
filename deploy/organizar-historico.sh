#!/usr/bin/env bash
# Coloca git local (histórico de mudanças) nas pastas que não têm: Portaria e página inicial do portal.
# Não muda nenhum arquivo nem reinicia nada. .env e arquivos .bak ficam fora do git.
set -euo pipefail

versionar() {  # $1 = pasta  $2 = descrição  $3 = sudo ou vazio
  local d=$1 s=${3:-}
  echo "== $d"
  if [ -d "$d/.git" ]; then echo "  já tem git"; git -C "$d" log --oneline -1; return; fi
  printf '.env\n.env.*\n*.bak*\nnode_modules/\ndist/\n' | $s tee "$d/.gitignore" >/dev/null
  $s git -C "$d" init -q -b main
  $s git -C "$d" add -A
  $s git -C "$d" -c user.name="ti" -c user.email="ti@localhost" commit -qm "Estado no servidor em $(date +%d/%m/%Y): $2"
  $s git -C "$d" log --oneline -1
  echo "  arquivos versionados: $($s git -C "$d" ls-files | wc -l)"
}

versionar ~/terceirizados "Portaria (zip do repositório do Matheus + Dockerfile/compose do servidor)"
versionar /var/www/portal "página inicial do portal (cards dos sistemas)"
echo "PRONTO. Ver o que mudou numa pasta: git -C <pasta> status   |   histórico: git -C <pasta> log --oneline"
