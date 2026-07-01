// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecureVote {
    address public admin;

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
    }

    struct ElectionDetails {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        bool isStarted;
        bool isEnded;
        uint256 totalVotes;
    }

    // Inside the contract, we track elections using nested mappings or parallel structures.
    // Solidity mappings are not iterable, so we keep track of candidate IDs.
    mapping(uint256 => ElectionDetails) public elections;
    
    // electionId => candidateId => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) public electionCandidates;
    
    // electionId => array of candidate IDs
    mapping(uint256 => uint256[]) public electionCandidateIds;
    
    // electionId => voterAddress => registered (true/false)
    mapping(uint256 => mapping(address => bool)) public registeredVoters;
    
    // electionId => voterAddress => voted (true/false)
    mapping(uint256 => mapping(address => bool)) public hasVotedMapping;

    uint256 public electionCount;

    // Events
    event ElectionCreated(uint256 indexed electionId, string title, uint256 startDate, uint256 endDate);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string party);
    event VoterRegistered(uint256 indexed electionId, address indexed voterAddress);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event VoteCasted(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function createElection(
        uint256 _id,
        string memory _title,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate
    ) external onlyAdmin {
        require(elections[_id].id == 0, "Election ID already exists");
        require(_startDate < _endDate, "Start date must be before end date");

        elections[_id] = ElectionDetails({
            id: _id,
            title: _title,
            description: _description,
            startDate: _startDate,
            endDate: _endDate,
            isStarted: false,
            isEnded: false,
            totalVotes: 0
        });

        electionCount++;
        emit ElectionCreated(_id, _title, _startDate, _endDate);
    }

    function addCandidate(
        uint256 _electionId,
        uint256 _candidateId,
        string memory _name,
        string memory _party
    ) external onlyAdmin {
        ElectionDetails storage election = elections[_electionId];
        require(election.id != 0, "Election does not exist");
        require(!election.isStarted, "Cannot add candidate after election starts");
        require(electionCandidates[_electionId][_candidateId].id == 0, "Candidate ID already exists");

        electionCandidates[_electionId][_candidateId] = Candidate({
            id: _candidateId,
            name: _name,
            party: _party,
            voteCount: 0
        });
        
        electionCandidateIds[_electionId].push(_candidateId);

        emit CandidateAdded(_electionId, _candidateId, _name, _party);
    }

    function registerVoter(uint256 _electionId, address _voter) external onlyAdmin {
        ElectionDetails storage election = elections[_electionId];
        require(election.id != 0, "Election does not exist");
        require(!election.isEnded, "Election already ended");
        require(!registeredVoters[_electionId][_voter], "Voter already registered");

        registeredVoters[_electionId][_voter] = true;
        emit VoterRegistered(_electionId, _voter);
    }

    function startElection(uint256 _electionId) external onlyAdmin {
        ElectionDetails storage election = elections[_electionId];
        require(election.id != 0, "Election does not exist");
        require(!election.isStarted, "Election already started");
        require(!election.isEnded, "Election already ended");

        election.isStarted = true;
        emit ElectionStarted(_electionId);
    }

    function endElection(uint256 _electionId) external onlyAdmin {
        ElectionDetails storage election = elections[_electionId];
        require(election.id != 0, "Election does not exist");
        require(election.isStarted, "Election must be started first");
        require(!election.isEnded, "Election already ended");

        election.isEnded = true;
        emit ElectionEnded(_electionId);
    }

    function vote(uint256 _electionId, uint256 _candidateId) external {
        ElectionDetails storage election = elections[_electionId];
        require(election.id != 0, "Election does not exist");
        require(election.isStarted, "Election is not active");
        require(!election.isEnded, "Election has ended");
        require(block.timestamp >= election.startDate, "Election has not started yet");
        require(block.timestamp <= election.endDate, "Election timeframe has passed");
        require(registeredVoters[_electionId][msg.sender], "You are not registered to vote in this election");
        require(!hasVotedMapping[_electionId][msg.sender], "You have already voted in this election");
        require(electionCandidates[_electionId][_candidateId].id == _candidateId, "Invalid candidate ID");

        hasVotedMapping[_electionId][msg.sender] = true;
        electionCandidates[_electionId][_candidateId].voteCount++;
        election.totalVotes++;

        emit VoteCasted(_electionId, msg.sender, _candidateId);
    }

    function hasVoted(uint256 _electionId, address _voter) external view returns (bool) {
        return hasVotedMapping[_electionId][_voter];
    }

    function isRegistered(uint256 _electionId, address _voter) external view returns (bool) {
        return registeredVoters[_electionId][_voter];
    }

    function getCandidates(uint256 _electionId) external view returns (Candidate[] memory) {
        uint256[] memory ids = electionCandidateIds[_electionId];
        Candidate[] memory candidatesList = new Candidate[](ids.length);
        
        for (uint256 i = 0; i < ids.length; i++) {
            candidatesList[i] = electionCandidates[_electionId][ids[i]];
        }
        
        return candidatesList;
    }

    function getWinner(uint256 _electionId) external view returns (uint256 id, string memory name, string memory party, uint256 voteCount) {
        uint256[] memory ids = electionCandidateIds[_electionId];
        require(ids.length > 0, "No candidates in this election");

        uint256 winningVoteCount = 0;
        uint256 winningIndex = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 cid = ids[i];
            if (electionCandidates[_electionId][cid].voteCount > winningVoteCount) {
                winningVoteCount = electionCandidates[_electionId][cid].voteCount;
                winningIndex = cid;
            }
        }

        Candidate storage winner = electionCandidates[_electionId][winningIndex];
        return (winner.id, winner.name, winner.party, winner.voteCount);
    }
}
