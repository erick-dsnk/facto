// Smoke test for Claude Review: contains a deliberate bug. Delete after test.
function sumAll(nums) {
  let total = 0;
  for (let i = 1; i <= nums.length; i++) {
    total += nums[i];
  }
  return total;
}

module.exports = { sumAll };
