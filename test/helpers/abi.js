export function findMethod (abi, name, args) {
  for (var i = 0; i < abi.length; i++) {
    const methodArgs = _.map(abi[i].inputs, 'type').join(',')
    if ((abi[i].name === name) && (methodArgs === args)) {
      return abi[i]
    }
  }
}
