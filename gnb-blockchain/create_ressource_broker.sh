set -x
ID=$RANDOM
ID_INT=$RANDOM
composer participant add  -d "{ \"\$class\": \"top.nextnet.gnb.ResourceBroker\",  \"id\": \"$ID\" }" -c "admin@gnb" 



composer identity issue -c admin@gnb -f rb$ID.card -u $ID -a "resource:top.nextnet.gnb.ResourceBroker#$ID"


composer card  import -f ./rb$ID.card 
