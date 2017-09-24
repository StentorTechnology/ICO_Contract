let StentorCrowdsale = artifacts.require('./StentorCrowdsale.sol');
let StentorToken = artifacts.require('./StentorToken.sol');

module.exports = async function(deployer, network, accounts) {

    //uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, address _wallet, address _token
    const startTime = Math.floor(+ new Date() / 1000);
    const endTime = Math.floor(+ new Date() /1000) + 600; //10 minutes into the future
    const rate = 1;
    const goal = 300000000 * Math.pow(10, 18); //300M tokens
    const cap = 500000000 * Math.pow(10, 18); //500M tokens
    const wallet = accounts[0];

    await deployer.deploy(StentorToken);
    deployer.deploy(StentorCrowdsale, startTime, endTime, rate, goal, cap, wallet, StentorToken.address);
};
