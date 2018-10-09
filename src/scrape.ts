import requests = require('request')
import fs = require('fs');

//require('request-debug')(requests)

let travis_api_headers = {
    'Travis-API-Version': 3,
    'User-Agent': 'travis-scraper'
}

/**
 * Get JSON from a travis endpoint. Uses Travis API Version 3 
 * @param path Path for the endpoint. Path should not include travis-ci.org
 * @param qs Object that will be transformed into a query string for the GET request
 */
function getTravisJSON(path: any, qs = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            requests.get({ url: "https://api.travis-ci.org" + path, qs: qs, headers: travis_api_headers, json: true },
                (err, res, body) => {
                    if (err) { reject(err) }
                    else {
                        resolve(body);
                    }
                })
        }
        catch (e) {
            reject(e);
        }
    })
}

/**
 * Fetch builds from a repository
 * @param repoID 
 * @returns A function that takes an offset (the number of builds to skip)
 *          and gives the next 100 builds after that offset
 */
function getBuilds(repoID: string): (offset: number) => Promise<any> {
    return (offset: number) => {
        return getTravisJSON('/repo/' + repoID + '/builds', { limit: 100, offset: offset })
    }
}

/**
 * 
 * @param repoID repository name (as user/repo, must be URI element encoded) or unique repository id number
 * @param totalCt total of number of builds available
 */
function getAllBuildsHelp(repoID: string, totalCt: number): Promise<any>[] {
    let pageCt: number = Math.ceil(totalCt / 100.0)
    let results: Promise<any>[] = new Array();
    let getAtOffset = getBuilds(repoID);
    for (let i = 0; i < pageCt; i++) {
        results.push(getAtOffset(i * 100));
    }
    return results;
}

/**
 * Get all builds for a repo as JSON 
 * @param repoID repository name (as user/repo, must be URI element encoded) or unique repository id number
 */
function getAllBuilds(repoID): Promise<any[]> {
    return (getBuilds(repoID)(0)
        .then(
            (body) => {
                console.log("Retrieved first build, fetching " + body['@pagination'].count + " builds.")
                return Promise.all(getAllBuildsHelp(repoID, body['@pagination'].count))
            }));
}

/**
 * 
 * @param object Object to write to file
 * @param fileName path to the required output file
 */
function writeJSON(object: any, fileName: string): void {
    const content = JSON.stringify(object);

    fs.writeFile(fileName, content, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
        console.log(fileName + " was saved.");
    });
}


/**
 * Given a build, get the hrefs of its jobs
 * @param build 
 */
function getJobHrefsFromBuild(build: any): string[] {
    return build.jobs.map(getHref);
}

/**
 * 
 * @param job get the href of a job
 */
function getHref(job: any): string {
    return job['@href'];
}

/**
 * Counts the builds and occurrences of each result state for the builds
 * @param builds 
 */
function processBuilds(builds: any[]): any {
    let buildCount = builds.length
    let states = {};
    for (let build of builds) {
        let buildState = build.state;
        if (buildState in states) {
            states[buildState] = states[buildState] + 1;
        }
        else {
            states[buildState] = 1;
        }
    }
    return { buildCount: buildCount, stateCount: states };
}

/**
 * Gets all builds and job hrefs, writing statistic files about them
 * @param repoID repository name (as user/repo not URI encoded) or unique repository id number
 */
function processTravis(repoID: string){
    repoID = encodeURIComponent(repoID);
let allBuildData = new Array();
let allBuilds = getAllBuilds(repoID);
allBuilds
    .then((allBuilds) => {
        console.log("All builds downloaded, processing.")
        let allJobs = new Array()
        for (let build of allBuilds) {
            allBuildData = allBuildData.concat(build.builds);
        }
        writeJSON(allBuildData, "builds.json");
        writeJSON(processBuilds(allBuildData), "buildStats.json");
        let allHrefs = allBuildData.map(getJobHrefsFromBuild);
        let flatHrefs = [].concat.apply([], allHrefs); //This flattens the array
        //return Promise.all(flatHrefs.map(getTravisJSON));
    })
    .then((jobs) => {
        writeJSON({ jobs: jobs }, "jobs.json");
    })
    .catch(error => console.log(error));
}

processTravis('awslabs/s2n');
