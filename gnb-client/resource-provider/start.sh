set -x

for CARD_NAME in $(composer card list -q |shuf |grep "^RP.*");
do
sed "s/RP_CARD_NAME/$CARD_NAME/g" config/default.json.tpl  > config/default.json
sleep 2
./provider_cli.js &
done;
read
ps -ef |grep "node ./provider_cli.js"|cut -d ' ' -f 2|xargs -I {} kill -9 {}
