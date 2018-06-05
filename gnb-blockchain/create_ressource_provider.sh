set -x
ID=$1

composer participant add --card admin@gnb --data "{\"\$class\": \"top.nextnet.gnb.ResourceProvider\",\"id\":\"$ID\"}"
composer identity issue -c admin@gnb -f ./RP$ID.card -u $ID -a "resource:top.nextnet.gnb.ResourceProvider#$ID"
composer card  import -f ./RP$ID.card 
