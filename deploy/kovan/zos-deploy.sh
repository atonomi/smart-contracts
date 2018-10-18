OWNER=0x48015f23eb79791050885f9464e6dea7456df60b
REGFEE=250000000000000000
ACTFEE=250000000000000000
REPREWARD=125000000000000000
REPSHARE=20
BLOCKTHRES=5760
STORAGE=0xd1bdb6955d76fcac648ccfde16506c30dd21f80c
TOKEN=0xe66254d9560c2d030ca5c3439c5d6b58061dd6f7
SETTINGSPROXY=0xdce9635a51a76e2b17da1fd4b249ccb83490767d

zos create NetworkSettings --init initialize --args $OWNER,$REGFEE,$ACTFEE,$REPREWARD,$REPSHARE,$BLOCKTHRES,$STORAGE  --network local --verbose
zos create TokenPool --init initialize --args $STORAGE --network local --verbose
zos create ReputationManager --init initialize --args $OWNER,$STORAGE,$TOKEN --network local --verbose
zos create NetworkMemberManager --init initialize --args $OWNER,$STORAGE --network local --verbose
zos create DeviceManager --init initialize --args $OWNER,$STORAGE,$TOKEN,$SETTINGSPROXY --network local --verbose