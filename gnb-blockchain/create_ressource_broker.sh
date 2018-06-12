set -x
ID=$1
composer participant add  -d "{ \"\$class\": \"top.nextnet.gnb.ResourceBroker\",  \"id\": \"RB$ID\" }" -c "admin@gnb" 



composer identity issue -c admin@gnb -f rb$ID.card -u RB$ID -a "resource:top.nextnet.gnb.ResourceBroker#RB$ID"


composer card  import -f ./rb$ID.card 
