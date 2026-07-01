import { expect } from "chai";
import { ethers } from "hardhat";
import { SecureVote } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SecureVote Smart Contract", function () {
  let secureVote: SecureVote;
  let admin: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let candidate1Id = 1;
  let candidate2Id = 2;
  let electionId = 101;

  beforeEach(async function () {
    [admin, voter1, voter2] = await ethers.getSigners();
    const SecureVoteFactory = await ethers.getContractFactory("SecureVote");
    secureVote = (await SecureVoteFactory.deploy()) as SecureVote;
    await secureVote.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await secureVote.admin()).to.equal(admin.address);
    });
  });

  describe("Election & Candidate Management", function () {
    it("Should allow admin to create an election", async function () {
      const now = Math.floor(Date.now() / 1000);
      const start = now + 100;
      const end = now + 1000;

      await expect(secureVote.createElection(electionId, "Presidential Election", "Vote for the next president", start, end))
        .to.emit(secureVote, "ElectionCreated")
        .withArgs(electionId, "Presidential Election", start, end);

      const election = await secureVote.elections(electionId);
      expect(election.title).to.equal("Presidential Election");
      expect(election.isStarted).to.be.false;
      expect(election.isEnded).to.be.false;
    });

    it("Should allow admin to add candidates before starting", async function () {
      const now = Math.floor(Date.now() / 1000);
      const start = now + 100;
      const end = now + 1000;

      await secureVote.createElection(electionId, "Presidential Election", "Vote for the next president", start, end);

      await expect(secureVote.addCandidate(electionId, candidate1Id, "Alice Smith", "Democratic Party"))
        .to.emit(secureVote, "CandidateAdded")
        .withArgs(electionId, candidate1Id, "Alice Smith", "Democratic Party");

      const candidates = await secureVote.getCandidates(electionId);
      expect(candidates.length).to.equal(1);
      expect(candidates[0].name).to.equal("Alice Smith");
      expect(candidates[0].party).to.equal("Democratic Party");
    });

    it("Should not allow candidate addition after starting", async function () {
      const now = Math.floor(Date.now() / 1000);
      const start = now - 50; // Started in the past for this test's purpose
      const end = now + 1000;

      await secureVote.createElection(electionId, "Presidential Election", "Vote for the next president", start, end);
      await secureVote.startElection(electionId);

      await expect(
        secureVote.addCandidate(electionId, candidate1Id, "Alice Smith", "Democratic Party")
      ).to.be.revertedWith("Cannot add candidate after election starts");
    });
  });

  describe("Voting Process", function () {
    let startTime: number;
    let endTime: number;

    beforeEach(async function () {
      const now = Math.floor(Date.now() / 1000);
      startTime = now - 100; // already started
      endTime = now + 1000;

      await secureVote.createElection(electionId, "Presidential Election", "Vote", startTime, endTime);
      await secureVote.addCandidate(electionId, candidate1Id, "Alice", "Party A");
      await secureVote.addCandidate(electionId, candidate2Id, "Bob", "Party B");
    });

    it("Should allow admin to register voter", async function () {
      await expect(secureVote.registerVoter(electionId, voter1.address))
        .to.emit(secureVote, "VoterRegistered")
        .withArgs(electionId, voter1.address);

      expect(await secureVote.isRegistered(electionId, voter1.address)).to.be.true;
    });

    it("Should allow registered voter to cast vote", async function () {
      await secureVote.registerVoter(electionId, voter1.address);
      await secureVote.startElection(electionId);

      await expect(secureVote.connect(voter1).vote(electionId, candidate1Id))
        .to.emit(secureVote, "VoteCasted")
        .withArgs(electionId, voter1.address, candidate1Id);

      expect(await secureVote.hasVoted(electionId, voter1.address)).to.be.true;
      
      const candidates = await secureVote.getCandidates(electionId);
      expect(candidates[0].voteCount).to.equal(1);
    });

    it("Should not allow unregistered voter to vote", async function () {
      await secureVote.startElection(electionId);
      await expect(
        secureVote.connect(voter1).vote(electionId, candidate1Id)
      ).to.be.revertedWith("You are not registered to vote in this election");
    });

    it("Should not allow voting twice", async function () {
      await secureVote.registerVoter(electionId, voter1.address);
      await secureVote.startElection(electionId);

      await secureVote.connect(voter1).vote(electionId, candidate1Id);
      
      await expect(
        secureVote.connect(voter1).vote(electionId, candidate2Id)
      ).to.be.revertedWith("You have already voted in this election");
    });
  });
});
