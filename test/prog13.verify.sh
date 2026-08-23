#!/usr/bin/env bash
set -u
B=http://localhost:6799/api/v1
cd "$(dirname "$0")/../ferio-nest-prisma"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
# usage: R=$(curl ...); TOK=$(tok "$R" data.token)
tok(){ local resp="$1"; local path="${2:-}"
printf '%s' "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin)
path='$path'.strip()
for k in ([x for x in path.split('.') if x] if path else []):
    d=d[int(k)] if isinstance(d,list) else d[k]
print('' if d is None else d)" 2>/dev/null; }
msg(){ printf '%s' "$1" | python3 -c "import json,sys;print(json.load(sys.stdin).get('message',''))" 2>/dev/null; }

echo "═══ 1. Staff TOTP lifecycle ═══"
R=$(curl -s -H content-type:application/json -X POST "$B/identity/platform/login" -d '{"email":"admin@ferio.test","password":"RootAdmin1!"}')
PTOK=$(tok "$R" data.token); [ -n "$PTOK" ] && ok "staff login pre-TOTP" || { bad "staff login: $R"; exit 9; }

R=$(curl -s -X POST "$B/identity/platform/totp/setup" -H "Authorization: Bearer $PTOK")
SECRET=$(tok "$R" data.secret); URI=$(tok "$R" data.otpauthUri)
[ -n "$SECRET" ] && ok "secret ${SECRET:0:8}… · uri ${URI:0:34}…" || bad "setup: $R"

CODE=$(npx ts-node --transpile-only -e "import{totpAt}from'./src/infrastructure/identity/totp';process.stdout.write(totpAt('$SECRET',Math.floor(Date.now()/1000)));")
CONF=$(curl -s -X POST "$B/identity/platform/totp/confirm" -H "Authorization: Bearer $PTOK" -H content-type:application/json -d "{\"code\":\"$CODE\"}")
[[ "$CONF" == *'"enabled":true'* ]] && ok "TOTP confirmed with valid code" || bad "confirm: $CONF"

ROLE=$(curl -s -H content-type:application/json -X POST "$B/identity/platform/login" -d "{\"email\":\"admin@ferio.test\",\"password\":\"RootAdmin1!\",\"code\":\"$CODE\"}" | tok data.user.role)
if [[ "$ROLE" == "SUPER_ADMIN" ]]; then
  ok "login with valid code -> SUPER_ADMIN"
else
  CODE3=$(npx ts-node --transpile-only -e "import{totpAt}from'./src/infrastructure/identity/totp';process.stdout.write(totpAt('$SECRET',Math.floor(Date.now()/1000)));")
  ROLE=$(curl -s -H content-type:application/json -X POST "$B/identity/platform/login" -d "{\"email\":\"admin@ferio.test\",\"password\":\"RootAdmin1!\",\"code\":\"$CODE3\"}" | tok data.user.role)
  [[ "$ROLE" == "SUPER_ADMIN" ]] && ok "login with fresh code -> SUPER_ADMIN (retry)" || bad "with code role='$ROLE'"
fi

M=$(msg "$(curl -s -H content-type:application/json -X POST "$B/identity/platform/login" -d '{"email":"admin@ferio.test","password":"RootAdmin1!"}')")
[[ "$M" == *"Valid TOTP code required"* ]] && ok "login w/o code blocked" || bad "w/o code: $M"

DIS=$(curl -s -X POST "$B/identity/platform/totp/disable" -H "Authorization: Bearer $PTOK" -H content-type:application/json -d "{\"code\":\"$CODE2\"}")
[[ "$DIS" == *'"enabled":false'* ]] && ok "disable with current code" || bad "disable: $DIS"
C=$(curl -s -o /dev/null -w '%{http_code}' -H content-type:application/json -X POST "$B/identity/platform/login" -d '{"email":"admin@ferio.test","password":"RootAdmin1!"}')
[[ "$C" == "200" ]] && ok "plain login post-disable (200)" || bad "post-disable: $C"

echo "═══ 2. Member role gates ═══"
CTOK=$(curl -s -H content-type:application/json -X POST "$B/identity/login" -d '{"email":"owner@demo.test","password":"supersecret1"}' | tok data.token)
PC=$(curl -s -X POST "$B/tenant/properties" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d '{"name":"ACL Tower Two","type":"RESIDENTIAL_BUILDING"}')
PID=$(tok "$PC" data.id); [ -n "$PID" ] && ok "ORGANIZATION_OWNER writes inventory" || bad "owner create: $PC"

R=$(curl -s -H content-type:application/json -X POST "$B/identity/register" -d '{"email":"acct13@demo.test","password":"supersecret1","displayName":"Nusrat A"}')
ATOK=$(tok "$R" data.token)
INV=$(curl -s -X POST "$B/tenant/iam/invites" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d '{"email":"acct13@demo.test","role":"ACCOUNTANT"}')
ITOK=$(tok "$INV" data.token)
ACC=$(curl -s -X POST "$B/tenant/iam/invites/accept" -H "Authorization: Bearer $ATOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"token\":\"$ITOK\",\"displayName\":\"Nusrat A\"}")
[[ "$ACC" == *accepted* ]] && ok "ACCOUNTANT invite accepted" || bad "accept: $ACC"

AC=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/tenant/properties" -H "Authorization: Bearer $ATOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d '{"name":"Nope","type":"SHOP"}')
MSG=$(msg "$(curl -s -X POST "$B/tenant/properties" -H "Authorization: Bearer $ATOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d '{"name":"Nope","type":"SHOP"}')")
[[ "$AC" == "403" ]] && ok "ACCOUNTANT inventory write blocked (403): $MSG" || bad "acct write: $AC '$MSG'"

UR=$(curl -s -o /dev/null -w '%{http_code}' "$B/tenant/units" -H "Authorization: Bearer $ATOK" -H X-Tenant-Slug:sheakh-fam)
[[ "$UR" == "200" ]] && ok "ACCOUNTANT reads units (200)" || bad "acct read: $UR"

OTOK=$(tok "$(curl -s -H content-type:application/json -X POST "$B/identity/register" -d '{"email":"out13@demo.test","password":"supersecret1","displayName":"Out"}')" data.token)
ORC=$(curl -s -o /dev/null -w '%{http_code}' "$B/tenant/units" -H "Authorization: Bearer $OTOK" -H X-Tenant-Slug:sheakh-fam)
[[ "$ORC" == "403" ]] && ok "non-member read blocked (403)" || bad "outsider read: $ORC"

echo "═══ 3. Renter portal ═══"
RTOK2=$(tok "$(curl -s -H content-type:application/json -X POST "$B/identity/register" -d '{"email":"renter13@demo.test","password":"supersecret1","displayName":"Rafiq R"}')" data.token)
RID=$(curl -s "$B/identity/me" -H "Authorization: Bearer $RTOK2" | tok data.userId)

U=$(curl -s -X POST "$B/tenant/units" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"propertyId\":\"$PID\",\"name\":\"T-201\",\"type\":\"APARTMENT\",\"floor\":20,\"bedrooms\":2,\"bathrooms\":2,\"areaSqFt\":1100}")
UID_=$(tok "$U" data.id)
RN=$(curl -s -X POST "$B/tenant/renters" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"centralUserId\":\"$RID\",\"name\":\"Rafiq R\",\"phone\":\"01711000000\",\"nidNumber\":\"1990123456789\"}" | tok data.id)
L=$(curl -s -X POST "$B/tenant/leases" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"unitId\":\"$UID_\",\"renterId\":\"$RN\",\"startDate\":\"2026-09-01\",\"endDate\":\"2027-08-31\",\"monthlyRent\":42000,\"status\":\"ACTIVE\"}")
LID=$(tok "$L" data.id)
[ -n "$LID" ] && ok "ACTIVE lease bound to renter identity" || bad "lease: $L"

ME=$(curl -s "$B/renter/me" -H "Authorization: Bearer $RTOK2")
UNITN=$(tok "$ME" data.unit.name); ORG=$(tok "$ME" data.organization.slug); OUT=$(tok "$ME" data.outstandingBdt)
[[ "$UNITN" == "T-201" && "$ORG" == "sheakh-fam" ]] && ok "renter/me → sheakh-fam · T-201 · outstanding $OUT" || bad "me: $ME"

BA=$(curl -s "$B/tenant/billing/accounts?unitId=$UID_" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam | tok data.id)
curl -s -X POST "$B/tenant/billing/charges" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"billingAccountId\":\"$BA\",\"category\":\"RENT\",\"label\":\"Rent\",\"amount\":42000}" > /dev/null
INVID=$(curl -s -X POST "$B/tenant/billing/invoices" -H "Authorization: Bearer $CTOK" -H X-Tenant-Slug:sheakh-fam -H content-type:application/json -d "{\"unitId\":\"$UID_\",\"periodStart\":\"2026-10-01\",\"periodEnd\":\"2026-10-31\",\"dueDate\":\"2026-10-10\"}" | tok data.id)
[ -n "$INVID" ] && ok "invoice issued for tenancy" || bad "invoice"

RP=$(curl -s -X POST "$B/renter/payments" -H "Authorization: Bearer $RTOK2" -H content-type:application/json -d "{\"invoiceId\":\"$INVID\",\"method\":\"BKASH\",\"amount\":15000,\"reference\":\"TXN-R-13\"}")
ST=$(tok "$RP" data.status)
[[ "$ST" == "REPORTED" ]] && ok "renter payment queued for verification (REPORTED)" || bad "report: $RP"

IV=$(curl -s "$B/renter/invoices" -H "Authorization: Bearer $RTOK2")
SUMMARY=$(printf '%s' "$IV" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'];print(len(d),'invoice(s);',len(d[0]['payments']),'payment(s) on latest')")
ok "renter invoices → $SUMMARY"

echo
echo "═══ RESULT: $PASS passed / $FAIL failed ═══"
exit $FAIL
