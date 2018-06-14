

set -x

export SERVICE_ID=$RANDOM
composer transaction submit --card admin@gnb -d "{  \"\$class\": \"org.hyperledger.composer.system.AddAsset\",  \"resources\": [  {   \"\$class\": \"top.nextnet.gnb.Service\",   \"serviceId\": \"$SERVICE_ID\",   \"public\": true,   \"intention\": \"resource:top.nextnet.gnb.Intention#Intention10\",   \"slices\": [     {       \"\$class\": \"top.nextnet.gnb.TransportSlice\",       \"bandwidth\": 6,       \"latency\": 100,       \"src\": \"0\",       \"dst\": \"2\",       \"id\": \"760cb836-21ec-4b23-bd9e-5bc9f9a20db9\"     },     {       \"\$class\": \"top.nextnet.gnb.TransportSlice\",       \"bandwidth\": 1,       \"latency\": 100,       \"src\": \"3\",       \"dst\": \"11\",       \"id\": \"f9e2617d-9b6f-4e05-be44-704c87e32c62\"     },     {       \"\$class\": \"top.nextnet.gnb.TransportSlice\",       \"bandwidth\": 10,       \"latency\": 100,       \"src\": \"4\",       \"dst\": \"5\",       \"id\": \"ffa4f5f8-6c19-4a3e-870d-50becb8883f7\"     },     {       \"\$class\": \"top.nextnet.gnb.TransportSlice\",       \"bandwidth\": 10,       \"latency\": 100,       \"src\": \"5\",       \"dst\": \"7\",       \"id\": \"a06d1edc-503c-49a5-994d-302357fbe8ed\"     }   ] }  ],  \"targetRegistry\": \"resource:org.hyperledger.composer.system.AssetRegistry#top.nextnet.gnb.Service\" }"


composer transaction submit --card admin@gnb  -d "{\"\$class\": \"top.nextnet.gnb.PublishService\", \"service\": \"resource:top.nextnet.gnb.Service#$SERVICE_ID\"}"
