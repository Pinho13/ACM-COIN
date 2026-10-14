// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Moeda is ERC20, Ownable {
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;

    uint256 public immutable maxSupply;
    uint256 public immutable inflationBps;
    uint256 public immutable feeBps;
    address public treasury;
    uint256 public lastInflationMint;

    error AboveMaxSupply();
    error FeeTooHigh();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        uint256 inflationBps_,
        uint256 feeBps_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (feeBps_ > 1_000) revert FeeTooHigh();
        if (maxSupply_ != 0 && initialSupply > maxSupply_) revert AboveMaxSupply();
        maxSupply = maxSupply_;
        inflationBps = inflationBps_;
        feeBps = feeBps_;
        treasury = msg.sender;
        lastInflationMint = block.timestamp;
        _mint(msg.sender, initialSupply);
    }

    function feeFor(uint256 amount) public view returns (uint256) {
        return (amount * feeBps + BPS - 1) / BPS;
    }

    function pendingInflation() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastInflationMint;
        uint256 amount = (totalSupply() * inflationBps * elapsed) / (BPS * YEAR);
        if (maxSupply != 0 && totalSupply() + amount > maxSupply) {
            amount = maxSupply - totalSupply();
        }
        return amount;
    }

    function mintInflation() external onlyOwner returns (uint256 amount) {
        amount = pendingInflation();
        lastInflationMint = block.timestamp;
        if (amount > 0) _mint(treasury, amount);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && feeBps != 0 && from != treasury) {
            super._update(from, treasury, feeFor(value));
        }
        super._update(from, to, value);
    }
}
