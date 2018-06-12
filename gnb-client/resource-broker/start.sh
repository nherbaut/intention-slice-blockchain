sed "s/RB_CARD_NAME/$(composer card list -q |grep "^RB.*")/g" config/default.json.tpl  > config/default.json
./broker_cli.js &
read
ps -ef |grep "node ./broker_cli.js"|cut -d ' ' -f 2|xargs -I {} kill -9 {}
