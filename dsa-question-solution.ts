/**
 * DSA Question: Two Sum
 *
 * Given an array of integers nums and an integer target, return indices of the
 * two numbers such that they add up to target.
 *
 * You may assume that each input would have exactly one solution, and you may
 * not use the same element twice.
 *
 * You can return the answer in any order.
 *
 * Example 1:
 * Input: nums = [2,7,11,15], target = 9
 * Output: [0,1]
 * Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
 *
 * Example 2:
 * Input: nums = [3,2,4], target = 6
 * Output: [1,2]
 *
 * Example 3:
 * Input: nums = [3,3], target = 6
 * Output: [0,1]
 *
 * Constraints:
 * - 2 <= nums.length <= 10^4
 * - -10^9 <= nums[i] <= 10^9
 * - -10^9 <= target <= 10^9
 * - Only one valid answer exists.
 *
 * Follow-up: Can you come up with an algorithm that is less than O(n^2) time complexity?
 */

/**
 * Solution 1: Brute Force Approach (O(n^2))
 * Checks every pair of numbers until the target is found.
 */
function twoSumBruteForce(nums: number[], target: number): number[] {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
                return [i, j];
            }
        }
    }
    throw new Error("No two sum solution exists");
}

/**
 * Solution 2: Hash Map Approach (O(n))
 * Uses a hash map to store previously seen numbers and their indices.
 * This is the optimal solution.
 */
function twoSum(nums: number[], target: number): number[] {
    const numMap = new Map<number, number>();

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];

        if (numMap.has(complement)) {
            return [numMap.get(complement)!, i];
        }

        numMap.set(nums[i], i);
    }

    throw new Error("No two sum solution exists");
}

// Test Cases
const runTests = (): void => {
    const testCases = [
        { nums: [2, 7, 11, 15], target: 9, expected: [0, 1] },
        { nums: [3, 2, 4], target: 6, expected: [1, 2] },
        { nums: [3, 3], target: 6, expected: [0, 1] },
        { nums: [0, 4, 3, 0], target: 0, expected: [0, 3] }
    ];

    console.log("Testing Two Sum Solution\n");

    for (const { nums, target, expected } of testCases) {
        const result = twoSum(nums, target);
        const sortedResult = [...result].sort((a, b) => a - b);
        const sortedExpected = [...expected].sort((a, b) => a - b);

        const passed = JSON.stringify(sortedResult) === JSON.stringify(sortedExpected);
        console.log(`Test: nums=${JSON.stringify(nums)}, target=${target}`);
        console.log(`  Expected: ${JSON.stringify(expected)}`);
        console.log(`  Got: ${JSON.stringify(result)}`);
        console.log(`  ${passed ? '✓ PASSED' : '✗ FAILED'}\n`);
    }
};

// Uncomment to run tests
// runTests();

// Export for use in other modules
export { twoSum, twoSumBruteForce, runTests };