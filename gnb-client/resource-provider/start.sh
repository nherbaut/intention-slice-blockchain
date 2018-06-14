set -x

for CARD_NAME in $(composer card list -q |grep "^RP.*");
do
sed "s/RP_CARD_NAME/$CARD_NAME/g" config/default.json.tpl  > config/default.json
./provider_cli.js &
break
done;

read
ps -ef |grep "node ./provider_cli.js"|cut -d ' ' -f 2|xargs -I {} kill -9 {}
