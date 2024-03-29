pragma solidity ^0.4.15;

import '../StentorCrowdsale.sol';

// @dev DevTokensHolderMock mocks current block time

contract StentorCrowdsaleMock is StentorCrowdsale {

    uint mock_time;
    uint cap;
    uint goal;

    function StentorCrowdsaleMock(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, uint256 _individualCap, address _vault, address _token, address _controller)
    StentorCrowdsale( _startTime, _endTime, _rate, _goal, _cap, _individualCap, _vault, _token, _controller) {
        mock_time = now;
        cap = _cap;
        goal = _goal;
    }

    function getTime() internal returns (uint256) {
        return mock_time;
    }

    function setMockedTime(uint _t) {
        mock_time = _t;
    }

    function getCap() internal returns (uint256) {
        return cap;
    }

    function setMockedCap(uint _cap) {
        cap = _cap;
    }

    function getGoal() internal returns (uint256) {
        return goal;
    }

    function setMockedGoal(uint _goal) {
        goal = _goal;
    }

}