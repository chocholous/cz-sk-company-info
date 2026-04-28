# 1Password-managed secrets template.
# Naplní se přes: op inject -i .env.tpl -o .env
#
# Pro lokální běh actoru přes `apify run` není APIFY_TOKEN nutný (Apify CLI ho čte z ~/.apify/auth.json).
# Token je potřeba pouze pokud chceš spustit code mimo Apify CLI nebo používat Apify Proxy přímo.

APIFY_TOKEN="op://Personal/Apify/api-token"
