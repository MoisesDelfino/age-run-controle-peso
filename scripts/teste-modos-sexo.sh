#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API_BASE="$BASE_URL/api"
TS="$(date +%s)"
DATA_PESAGEM="$(date +%F)"

H_EMAIL="teste-homem-${TS}@agerun.local"
M_EMAIL="teste-mulher-${TS}@agerun.local"
SENHA="Teste@123"

COOKIE_H="/tmp/age_run_cookie_h_${TS}.txt"
COOKIE_M="/tmp/age_run_cookie_m_${TS}.txt"

cleanup() {
  rm -f "$COOKIE_H" "$COOKIE_M"
}
trap cleanup EXIT

echo "=========================================================="
echo "Teste de modos por sexo"
echo "Base URL: $BASE_URL"
echo "=========================================================="

post_json() {
  local url="$1"
  local json="$2"
  local cookie_file="$3"

  curl -sS -X POST "$url" \
    -H "Content-Type: application/json" \
    -b "$cookie_file" -c "$cookie_file" \
    -d "$json"
}

get_json_with_status() {
  local url="$1"
  local cookie_file="$2"

  curl -sS -w "\nHTTP_STATUS:%{http_code}" \
    -b "$cookie_file" -c "$cookie_file" \
    "$url"
}

extract_status() {
  echo "$1" | awk -F: '/HTTP_STATUS/{print $2}'
}

extract_body() {
  echo "$1" | sed '/HTTP_STATUS:/d'
}

echo "[1/8] Cadastrando homem..."
resp_h_cadastro="$(post_json "$API_BASE/auth/cadastro" "{\"nome\":\"Teste Homem\",\"email\":\"$H_EMAIL\",\"sexo\":\"masculino\",\"senha\":\"$SENHA\"}" "$COOKIE_H")"
echo "$resp_h_cadastro"

echo "[2/8] Cadastrando mulher..."
resp_m_cadastro="$(post_json "$API_BASE/auth/cadastro" "{\"nome\":\"Teste Mulher\",\"email\":\"$M_EMAIL\",\"sexo\":\"feminino\",\"senha\":\"$SENHA\"}" "$COOKIE_M")"
echo "$resp_m_cadastro"

echo "[3/8] Verificando sessão (homem)..."
resp_h_sessao="$(get_json_with_status "$API_BASE/auth/session" "$COOKIE_H")"
body_h_sessao="$(extract_body "$resp_h_sessao")"
status_h_sessao="$(extract_status "$resp_h_sessao")"
echo "$body_h_sessao"
echo "Status: $status_h_sessao"

echo "[4/8] Verificando sessão (mulher)..."
resp_m_sessao="$(get_json_with_status "$API_BASE/auth/session" "$COOKIE_M")"
body_m_sessao="$(extract_body "$resp_m_sessao")"
status_m_sessao="$(extract_status "$resp_m_sessao")"
echo "$body_m_sessao"
echo "Status: $status_m_sessao"

echo "[5/8] Registrando pesagem para homem..."
resp_h_peso="$(curl -sS -X POST "$API_BASE/pesagens" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_H" -c "$COOKIE_H" \
  -d "{\"peso\":90.5,\"data_pesagem\":\"$DATA_PESAGEM\"}")"
echo "$resp_h_peso"

echo "[6/8] Registrando pesagem para mulher..."
resp_m_peso="$(curl -sS -X POST "$API_BASE/pesagens" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_M" -c "$COOKIE_M" \
  -d "{\"peso\":72.3,\"data_pesagem\":\"$DATA_PESAGEM\"}")"
echo "$resp_m_peso"

echo "[7/8] Ranking para homem (esperado: HTTP 200)..."
resp_h_ranking="$(get_json_with_status "$API_BASE/ranking" "$COOKIE_H")"
body_h_ranking="$(extract_body "$resp_h_ranking")"
status_h_ranking="$(extract_status "$resp_h_ranking")"
echo "$body_h_ranking"
echo "Status: $status_h_ranking"

echo "[8/8] Ranking para mulher (esperado: HTTP 403 + code=RANKING_RESTRITO)..."
resp_m_ranking="$(get_json_with_status "$API_BASE/ranking" "$COOKIE_M")"
body_m_ranking="$(extract_body "$resp_m_ranking")"
status_m_ranking="$(extract_status "$resp_m_ranking")"
echo "$body_m_ranking"
echo "Status: $status_m_ranking"

echo "=========================================================="
if [[ "$status_h_sessao" == "200" && "$status_m_sessao" == "200" && "$status_h_ranking" == "200" && "$status_m_ranking" == "403" ]]; then
  echo "OK: Fluxo validado (homem com ranking geral, mulher com restrição)."
  exit 0
fi

echo "ATENCAO: Algum status nao ficou como esperado."
exit 1
