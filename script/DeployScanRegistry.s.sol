// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Counter.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ScanRegistry registry = new ScanRegistry();
        console.log("ScanRegistry deployed to:", address(registry));

        vm.stopBroadcast();
    }
}