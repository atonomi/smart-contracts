import { expect } from 'chai'

const asyncReturnErr = async (asyncFn) => {
  try {
    await asyncFn
  } catch (err) {
    return err
  }
}

export async function expectRevert (asyncFn) {
  const err = await asyncReturnErr(asyncFn)
  expect(
    typeof err !== 'undefined',
    'expected function to revert, but it succeeded'
  ).to.equal(true)
  if (typeof err !== 'undefined') {
    expect(
      err.message.search('revert') > -1,
      `expected error message "${err.message}" to contain "revert"`
    ).to.equal(true)
  }
}

export async function expectError (asyncFn) {
  const err = await asyncReturnErr(asyncFn)
  expect(
    typeof err !== 'undefined',
    'expected function to revert, but it succeeded'
  ).to.equal(true)
  if (typeof err !== 'undefined') {
    expect(
      err.message.search('revert') > -1,
      `expected error message "${err.message}" to contain "revert"`
    ).to.equal(true)
  }
}
