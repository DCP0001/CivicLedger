/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "secure-vote",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // Deploy the voter frontend Next.js application
    const voter = new sst.aws.Nextjs("VoterFrontend", {
      path: "voter-frontend",
    });

    // Deploy the admin frontend Next.js application
    const admin = new sst.aws.Nextjs("AdminFrontend", {
      path: "admin-frontend",
    });

    // Output the generated URLs once the deployment succeeds
    return {
      voterUrl: voter.url,
      adminUrl: admin.url,
    };
  },
});
