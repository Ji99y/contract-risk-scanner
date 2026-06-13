// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScanRegistry {
    event ScanRequested(address indexed target, uint256 indexed chainId, address indexed requester, string checkType, uint256 timestamp);
    event ScanResultLogged(address indexed target, address indexed requester, uint8 riskScore, string riskLevel, string recommendation, uint256 timestamp);

    address public owner;
    uint256 public totalScans;

    struct ScanRecord {
        address target;
        uint256 chainId;
        uint8 riskScore;
        string riskLevel;
        string recommendation;
        uint256 timestamp;
    }

    mapping(address => ScanRecord[]) public scansByRequester;
    mapping(address => ScanRecord) public lastScanByTarget;

    constructor() {
        owner = msg.sender;
    }

    function requestScan(address target, uint256 chainId, string calldata checkType) external {
        totalScans++;
        emit ScanRequested(target, chainId, msg.sender, checkType, block.timestamp);
    }

    function logScanResult(address target, uint256 chainId, uint8 riskScore, string calldata riskLevel, string calldata recommendation) external {
        ScanRecord memory record = ScanRecord({ target: target, chainId: chainId, riskScore: riskScore, riskLevel: riskLevel, recommendation: recommendation, timestamp: block.timestamp });
        scansByRequester[msg.sender].push(record);
        lastScanByTarget[target] = record;
        emit ScanResultLogged(target, msg.sender, riskScore, riskLevel, recommendation, block.timestamp);
    }

    function getLastScan(address target) external view returns (ScanRecord memory) {
        return lastScanByTarget[target];
    }

    function getScansByRequester(address requester) external view returns (ScanRecord[] memory) {
        return scansByRequester[requester];
    }
}
