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
let videoIDs = [];
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


const csv = ["Video Title", "Thumbnail", "Channel Title","Video Description", "Publish Date","Url", "Views", "Likes", "Comments", "Channel Description", "Categories","Language","Tags","Duration"];
const videoUrl = "https://www.youtube.com/watch?v=";
let totalResults;
let foutcode;
let loadedPages = [];
let resultsPerPage;
let currentPage = 0;
let size;
let result = 0;
let tokenList = [];
let nextPageToken = "";
let channelObject;
let searchObject;
let videoObject;
let dataObject;
let maxVisibleRequests;
let maxKeys;

let searchQuery;

// const apiKey = "AIzaSyBS699Q19K70lVJ1zzKlaE_NU4zF8IpvZE";
// const apiKey = "AIzaSyD0WGLPPV_2m9ZQpe07PlzY8pg6KlmU0HU";
// const apiKey = "AIzaSyBD0eqh2x-H0XCxT0jicpNVTuBwsTOHw4Q";
// const apiKey = "AIzaSyAcyfNE1hvPTkZsATNggbaNIsh2yh-HOi0";
// const apiKey = "AIzaSyAYqWAY34gE8kGlBz6fdItByDabY_m72q0";
// const apiKey= "AIzaSyC2R6kmg26jBj9ufwKn25-TstyKszFv-Z4";
const apiKey ="AIzaSyCRS0u_wawIONwzWyxUrSGOqaUwPQxCdAQ";
const apiUrl = "https://www.googleapis.com/youtube/v3";

const youtubeSearch = google.youtube({
  version: "v3",
  auth: apiKey
});

app.get("/", function(req, res) {
  res.render("home", {});



  // for(let u=0;u<loadedPages.length;u++){
  //
  // }


});

app.post("/", function(req, res) {
  searchQuery = req.body.searchQuery;
  resultsPerPage = req.body.results;
  maxVisibleRequests = req.body.maximum_results;
  console.log(searchQuery, resultsPerPage);

  res.redirect("/search");
});


app.get("/search", async function(req, res, next) {
  try {
    const searchResponse = await youtubeSearch.search.list({
      part: "id, snippet",
      q: searchQuery,
      type: "video",
      maxResults: resultsPerPage
    });
    videoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
    const channelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
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
    // loadedPages.push([ searchObject?.snippet?.title, searchObject?.snippet?.thumbnails?.high?.url, searchObject?.snippet?.channelTitle,searchObject?.snippet?.description,searchObject?.snippet?.publishTime,videoObject?.statistics?.viewCount,videoObject?.statistics?.likeCount,videoObject?.statistics?.commentCount,channelObject?.snippet?.description,videoObject?.topicDetails?.topicCategories,videoObject?.snippet?.defaultAudioLanguage,videoObject?.snippet?.tags,videoObject?.contentDetails?.duration]);

  } catch (err) {
    res.redirect("/search/error/" + encodeURIComponent(err.message));
    return;
  }
  // Belangrijk om te weten of de loadedpages push goed staat ivm try catch, ook goed om te weten of het komt als een loadedPages[result][searchObject][videoObject][channelObject]

  tokenList.push(nextPageToken);
  size = resultsPerPage;
  if (totalResults < maxVisibleRequests) {
    maxVisibleRequests = totalResults;

  }
  maxKeys = maxVisibleRequests / resultsPerPage;
  console.log("maxKeys", maxKeys, "maxVisibleRequests", maxVisibleRequests, "resultsPerPage", resultsPerPage);
  try {

    for (let i = 0; i < maxKeys; i++) {
      searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[i],
        maxResults: resultsPerPage
      });
      tokenList.push(searchResponse.data.nextPageToken);
    }
    console.log("tokenlist", tokenList);
  } catch (err) {
    res.redirect("/search/error/" + encodeURIComponent(err.message));

  }
  console.log(videoIDs);
  res.render("resultPage", {
    size: size,
    searchObject: searchObject,
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
  console.log("current key", currentKey);

  result = _.findIndex(tokenList, (token) => token === currentKey);
  console.log("current page", result);
  if (result < loadedPages.length) {
    console.log("paginas geladen tot nu:", loadedPages.length);
    res.render("resultPage", {
      size: size,
      searchObject: loadedPages[result][0],
      videoObject: loadedPages[result][1],
      channelObject: loadedPages[result][2],
      currentPage: result,
      nextToken: tokenList
    });
  } else {
    try {
      const searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[result]
      });
      const videoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
      const channelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
      searchObject = searchResponse.data?.items;
      nextPageToken = searchResponse.data?.nextPageToken;
      try {
        const videoResponse = await youtubeSearch.videos.list({
          part: "snippet, statistics, topicDetails, contentDetails",
          id: videoIDs.join(",")
        });
        videoObject = videoResponse.data?.items;
      } catch (err) {
        res.redirect("/search/error/" + encodeURIComponent(err.message));
      }
      try {
        const channelResponse = await youtubeSearch.channels.list({
          part: "snippet",
          id: channelIDs.join(",")
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

    loadedPages.push([searchObject, videoObject, channelObject]);
    res.render("resultPage", {
      size: size,
      searchObject: searchObject,
      videoObject: videoObject,
      channelObject: channelObject,
      currentPage: result,
      nextToken: tokenList
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

  res.render("", )
});
app.get("/download:keyword", async function(req, res) {
  console.log("redirecten is gelukt");


  console.log("loadedPages.length", loadedPages.length);

// tokenlist daarin staan de nextpage tokens
for(let o; o< tokenlist.length;o++){
      try {
        const searchResponse = await youtubeSearch.search.list({
          part: "id, snippet",
          q: searchQuery,
          type: "video",
          maxResults: resultsPerPage,
          nextToken: tokenList[o]
        });
        const videoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
        const channelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
        searchObject = searchResponse.data?.items;
        nextPageToken = searchResponse.data?.nextPageToken;
        try {
          const videoResponse = await youtubeSearch.videos.list({
            part: "snippet, statistics, topicDetails, contentDetails",
            id: videoIDs.join(",")
          });
          videoObject = videoResponse.data?.items;
          // console.log("videoobject", videoObject);
        } catch (err) {
          console.log("err1");
          res.redirect("/search/error/" + encodeURIComponent(err.message));
          return;
        }
        try {
          const channelResponse = await youtubeSearch.channels.list({
            part: "snippet",
            id: channelIDs.join(",")
          });
          channelObject = channelResponse.data?.items ?? [];
        } catch (err2) {
          console.log("err2");
          res.redirect("/search/error/" + encodeURIComponent(err.message));
          return;
        }
        // console.log("push naar loadedPages");
        loadedPages.push([searchObject[o]?.snippet?.title || "", searchObject[o]?.snippet?.thumbnails?.high?.url || "", searchObject[o]?.snippet?.channelTitle || "", searchObject[o]?.snippet?.description || "", searchObject[o]?.snippet.publishTime || "", videoUrl + videoIDs[o], videoObject[o]?.statistics.viewCount || "", videoObject[o]?.statistics.likeCount || "", videoObject[o]?.statistics?.commentCount || "disabled", channelObject[o]?.snippet?.description || "", videoObject[o]?.topicDetails?.topicCategories?.join(",") || "", videoObject[o]?.snippet?.defaultAudioLanguage || "not available", videoObject[o]?.snippet?.tags?.join(",") || "", videoObject[o]?.contentDetails?.duration || ""]);

      } catch (err) {
        console.log(err);
      }
}


  // loadedPages = loadedPages.map(item=>{
  //    if(!(typeof item==="object")){
  //     return item
  //   }
  //   return item.join(",")
  // })

  console.log("loadedPages", loadedPages);

  const csvFromArrayOfArrays = await convertArrayToCSV([csv, ...loadedPages], {
    csv,
    separator: ';'
  });
  // console.log("csv data", csvFromArrayOfArrays);
  download(csvFromArrayOfArrays, searchQuery, res);

  // for(let u=0;u<loadedPages.length;u++){
  //
  // }
});


app.listen(3000, function() {
  console.log("app running on port 3000");
});
app.post("/download", function(req, res) {
  console.log("redirecten naar downloads");
  res.redirect("/download" + searchQuery);
});
