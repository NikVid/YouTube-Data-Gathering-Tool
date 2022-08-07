const express = require("express");
const app = express();
const axios = require("axios");
const bodyParser = require("body-parser");
const ejs = require('ejs');
const {
  google
} = require("googleapis");
const _ = require("lodash");

const {
  convertArrayToCSV
} = require('convert-array-to-csv');
const converter = require('convert-array-to-csv');
const {
  creatCsvFile,
  downloadFile,
  detectionClientType
} = require("download-csv");
const convertCsvToXlsx = require('@aternus/csv-to-xlsx');
const fs = require("fs");
const path = require('path');
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static(__dirname + '/public'));
//
async function download(data, searchQuery, res) {
  // console.log(data);


  res.header('Content-Type', 'text/csv');
  res.attachment("Youtube_Data_" + searchQuery + ".csv");
  res.send(data);
}
//

let finalFile = [];
const csv = ["Video Title", "Thumbnail", "Channel Title", "Video Description", "Publish Date", "Url", "Views", "Likes", "Comments", "Channel Description", "Categories", "Language", "Tags", "Duration"];
const videoUrl = "https://www.youtube.com/watch?v=";
let totalResults;
let foutcode;
let loadedPages = [];
let size = 5;
let currentPage = 0;
let result = 0;
let tokenList = [];
let nextPageToken = "";
let channelObject;
let searchObject;
let videoObject;
let dataObject;
const maxKeys=10;
let channelIDs = [];
let videoIDs = [];
let tempChannelIDs;
let tempVideoIDs;
let searchQuery;
let apiKey= "";
// const apiKey = "AIzaSyBS699Q19K70lVJ1zzKlaE_NU4zF8IpvZE";
// const apiKey = "AIzaSyD0WGLPPV_2m9ZQpe07PlzY8pg6KlmU0HU";
// const apiKey = "AIzaSyBD0eqh2x-H0XCxT0jicpNVTuBwsTOHw4Q";
// const apiKey = "AIzaSyAcyfNE1hvPTkZsATNggbaNIsh2yh-HOi0";
// const apiKey = "AIzaSyAYqWAY34gE8kGlBz6fdItByDabY_m72q0";
// const apiKey= "AIzaSyC2R6kmg26jBj9ufwKn25-TstyKszFv-Z4";
// const apiKey = "AIzaSyCaqxbqmx94vEDJsKKMBjMza1P6mhMCeaQ";
// const apiKey ="AIzaSyCXB9ABuaBpQPGmYj6SecDg22O72LN2SJk";
const apiUrl = "https://www.googleapis.com/youtube/v3";
let youtubeSearch = google.youtube({
  version: "v3",
  auth: apiKey
});


app.get("/", function(req, res) {
  res.render("home", {});
  finalFile = [];
   totalResults=0;
   foutcode="";
   loadedPages = [];
   currentPage = 0;
   result = 0;
   tokenList = [];
   nextPageToken = "";
   searchQuery="";
   apiKey= "";

});

app.post("/", function(req, res) {
  searchQuery = req.body.searchQuery;
  apiKey = req.body.apiKey
  console.log(searchQuery, apiKey);
  youtubeSearch = google.youtube({
    version: "v3",
    auth: apiKey
  });
  res.redirect("/search");
});

app.get("/search", async function(req, res, next) {

  try {
    const searchResponse = await youtubeSearch.search.list({
      part: "id, snippet",
      q: searchQuery,
      type: "video",
      maxResults: size
    });
    tempVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
    videoIDs = videoIDs.concat([tempVideoIDs]);
    tempChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
    channelIDs = channelIDs.concat([tempChannelIDs]);
    searchObject = searchResponse.data?.items;
    nextPageToken = searchResponse.data?.nextPageToken;
    totalResults = searchResponse.data?.pageInfo.totalResults;
    try {
      const videoResponse = await youtubeSearch.videos.list({
        part: "snippet, statistics, topicDetails, contentDetails",
        id: videoIDs.join(",")
      });
      videoObject = videoResponse.data?.items;
    } catch (err) {
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      return;
    }
    try {
      const channelResponse = await youtubeSearch.channels.list({
        part: "snippet",
        id: channelIDs.join(",")
      });
      channelObject = channelResponse.data?.items ?? [];
    } catch (err) {

      res.redirect("/search/error/" + encodeURIComponent(err.message));
      return;
    }

  } catch (err) {
    res.redirect("/search/error/" + encodeURIComponent(err.message));
    return;
  }
  tokenList.push(nextPageToken);
  try {
    for (let i = 0; i < maxKeys; i++) {
      searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[i],
        maxResults: 50
      });
      tokenList.push(searchResponse.data.nextPageToken);
      tempVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
      tempChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
      console.log("videoIds old", videoIDs);
      console.log("tempvideo ids", tempVideoIDs);
      videoIDs = videoIDs.concat([tempVideoIDs]);
      channelIDs = channelIDs.concat([tempChannelIDs]);
      console.log("videoids new", videoIDs);

    }
    console.log("tokenlist", tokenList);
  } catch (err) {
    res.redirect("/search/error/" + encodeURIComponent(err.message));

  }
  res.render("resultPage", {
    size: size,

    videoObject: videoObject,
    channelObject: channelObject,
    nextToken: tokenList,
    currentPage: currentPage,
    videoIds: videoIDs,
    videoUrl: videoUrl

  });
});

app.get("/search/:key", async function(req, res) {
  let currentKey = req.params.key;
  console.log("Current key:", currentKey);

  result = _.findIndex(tokenList, (token) => token === currentKey);
  console.log("Current page", result);
  if (result < loadedPages.length) {
    console.log("Pages loaded:", loadedPages.length);
    res.render("resultPage", {
      size: size,
      videoObject: loadedPages[result][0],
      channelObject: loadedPages[result][1],
      currentPage: result,
      nextToken: tokenList,
      videoUrl: videoUrl,
      videoIds: videoIDs
    });
  } else {
    try {
      const searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[result]
      });
      let searchVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
      let searchChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
      searchObject = searchResponse.data?.items;
      try {
        const videoResponse = await youtubeSearch.videos.list({
          part: "snippet, statistics, topicDetails, contentDetails",
          id: searchVideoIDs.join(",")
        });
        videoObject = videoResponse.data?.items;
      } catch (err) {
        res.redirect("/search/error/" + encodeURIComponent(err.message));
      }
      try {
        const channelResponse = await youtubeSearch.channels.list({
          part: "snippet",
          id: searchChannelIDs.join(",")
        });
        channelObject = channelResponse.data?.items;
      } catch (err) {
        res.redirect("/search/error/" + encodeURIComponent(err.message));
        return;
      }
    } catch (err) {
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      return;
    }
    loadedPages.push([videoObject, channelObject]);
    res.render("resultPage", {
      size: size,
      videoObject: videoObject,
      channelObject: channelObject,
      currentPage: result,
      nextToken: tokenList,
      videoUrl: videoUrl,
      videoIds: videoIDs
    });
  }
});


app.get("/search/error/:error", function(req, res) {
  foutcode = req.params.error;
  res.render("error", {
    foutcode: foutcode
  })
});

app.get("/about", function(req, res) {

  res.render("about",{} )
});

app.get("/feedback", function(req,res){
  res.render("feedback",{})
});

app.post("/download", function(req, res) {
  console.log("redirect to downloads");
  res.redirect("/download" + searchQuery);
});


app.get("/download:keyword", async function(req, res, next) {
  console.log("redirect succeeded");
  for (let y = 0; y < tokenList.length; y++) {
    try {
      const videoResponse = await youtubeSearch.videos.list({
        part: "snippet, statistics, topicDetails, contentDetails",
        id: videoIDs[y]
      });
      videoObject = videoResponse.data?.items;
    } catch (err) {
      res.redirect("/search/error/" + encodeURIComponent(err.message));
    }
    try {
      const channelResponse = await youtubeSearch.channels.list({
        part: "snippet",
        id: channelIDs[y]
      });
      channelObject = channelResponse.data?.items;
    } catch (err) {
      next(err);

    }
    loadedPages.push([videoObject, channelObject]);
    for (let x = 0; x < videoIDs[y].length; x++) {
      finalFile.push([loadedPages[y][0][x]?.snippet?.title || "", loadedPages[y][0][x]?.snippet?.thumbnails?.high?.url || "", loadedPages[y][1][x]?.snippet?.title || "", loadedPages[y][0][x]?.snippet?.description || "", loadedPages[y][0][x]?.snippet.publishedAt || "", videoUrl + videoIDs[y][x], loadedPages[y][0][x]?.statistics.viewCount || "", loadedPages[y][0][x]?.statistics.likeCount || "", loadedPages[y][0][x]?.statistics?.commentCount || "disabled", loadedPages[y][1][x]?.snippet?.description || "", loadedPages[y][0][x]?.topicDetails?.topicCategories?.join(",") || "", loadedPages[y][0][x]?.snippet?.defaultAudioLanguage || "not available", loadedPages[y][0][x]?.snippet?.tags?.join(",") || "", loadedPages[y][0][x]?.contentDetails?.duration || ""]);
    }
  }
  console.log("downloadFile", finalFile);
  finalFile.flat();
  console.log("downloadfile but flat like small titties", finalFile);
  const csvFromArrayOfArrays = await convertArrayToCSV([csv, ...finalFile], {
    csv,
    separator: ';'
  });
  download(csvFromArrayOfArrays, searchQuery, res);
});



app.listen(3000, function() {
  console.log("app running on port 3000");
});
