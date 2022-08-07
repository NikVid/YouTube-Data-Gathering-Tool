//npm packages

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

const fs = require("fs");
const path = require('path');

//Initialize express and bodyparser
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static(__dirname + '/public'));

//Initialize  key variable for googleapis
let apiKey= "";
let youtubeSearch = google.youtube({
  version: "v3",
  auth: apiKey
});

//Creates a file with the headers, writes the data into the csv file and downloads it
async function download(data, searchQuery, res) {
  res.header('Content-Type', 'text/csv');
  res.attachment("Youtube_Data_" + searchQuery + ".csv");
  res.send(data);
}

//all variables
const csv = ["Video Title", "Thumbnail", "Channel Title", "Video Description", "Publish Date", "Url", "Views", "Likes", "Comments", "Channel Description", "Categories", "Language", "Tags", "Duration"];
const videoUrl = "https://www.youtube.com/watch?v=";
const maxKeys=10;
const apiUrl = "https://www.googleapis.com/youtube/v3";

let errorCode;
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
let finalFile = [];
let channelIDs = [];
let videoIDs = [];
let tempChannelIDs;
let tempVideoIDs;
let searchQuery;


//Home page
app.get("/", function(req, res) {
  //Loads home.ejs
  res.render("home", {});

  //Clear all important variables
  finalFile = [];
   errorCode="";
   loadedPages = [];
   currentPage = 0;
   result = 0;
   tokenList = [];
   nextPageToken = "";
   searchQuery="";
   apiKey= "";
});

//Executed when you press the search button on the home page
app.post("/", function(req, res) {
  // Using bodyparser to get search term and api key
  searchQuery = req.body.searchQuery;
  apiKey = req.body.apiKey;
  console.log(searchQuery, apiKey);

  //Set the right api key
  youtubeSearch = google.youtube({
    version: "v3",
    auth: apiKey
  });

  //Load search.ejs
  res.redirect("/search");
});

app.get("/search", async function(req, res, next) {
  //Makes an api query on YouTubes search query
  try {
    //Using googelapis to make the query and adding the filters
    const searchResponse = await youtubeSearch.search.list({
      part: "id, snippet", //filters to get the information needed
      q: searchQuery,  //the searchquery, using the one that we got at /post
      type: "video", //otherwise we might get channels and playlists
      maxResults: size //only retrieving five, more is possible, but this will use a lot of the api quota. There is IMO enough videos to decide weither to download or not
    });
    //Putting the video id's into arrays and then joining them with the main array of the video id's, which can then be used for downloading
    tempVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
    videoIDs = videoIDs.concat([tempVideoIDs]);
    //Putting the channel id's into arrays and then joining them with the main array of the channel id's , which then can be used for downloading
    tempChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
    channelIDs = channelIDs.concat([tempChannelIDs]);
    searchObject = searchResponse.data?.items;
    //Next page token is important to get more results
    nextPageToken = searchResponse.data?.nextPageToken;
    //storing the token in a list
    tokenList.push(nextPageToken);
    //Call the YouTube api for information about the videos that were received at the searchquery. We use the list of video id's to request the information
    try {
      const videoResponse = await youtubeSearch.videos.list({
        part: "snippet, statistics, topicDetails, contentDetails", //All the parts we need
        id: videoIDs.join(",") //we use the list of video id's
      });
      //We store the videoObject
      videoObject = videoResponse.data?.items;
    } catch (err) {
      //In case of an error we redirect to error.ejs, providing the error
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      //This prevents another error
      return;
    }
    //Making a request to the YouTube api for the channel information of the videos
    try {
      const channelResponse = await youtubeSearch.channels.list({
        part: "snippet", //That is all we need
        id: channelIDs.join(",") //we use the list of channel id's
      });
      channelObject = channelResponse.data?.items ?? [];
    } catch (err) {
      //In case of an error we redirect to error.ejs, providing the error
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      //This prevents another error
      return;
    }
  } catch (err) {
    //In case of an error we redirect to error.ejs, providing the error
    res.redirect("/search/error/" + encodeURIComponent(err.message));
    //This prevents another error
    return;
  }
//Requesting all video id's based upon the maxKeys, which are 10 in case of the maxResults of 50-> the result of the sum can only have a maximum of 500
  try {
    for (let i = 0; i < maxKeys; i++) {
      searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[i], //Using the tokenlist to go to the next 50 results
        maxResults: 50 //this is the maximum amount for the YouTube api
      });
      //Pushing the new nextPageToken to the list
      tokenList.push(searchResponse.data.nextPageToken);
      //Putting the video id's into arrays and then joining them with the main array of the video id's, which can then be used for downloading
      tempVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
      videoIDs = videoIDs.concat([tempVideoIDs]);
      //Putting the channel id's into arrays and then joining them with the main array of the channel id's , which then can be used for downloading
      tempChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
      channelIDs = channelIDs.concat([tempChannelIDs]);
    }
    console.log("This is the full list of nextPageTokens", tokenList);
  } catch (err) {
    //In case of an error we redirect to error.ejs, providing the error
    res.redirect("/search/error/" + encodeURIComponent(err.message));
    //This prevents another error
    return;
  }
  //Load resultPage.ejs with the variables needed
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

//Load search.ejs with the nextPageToken passed from the resultPage.ejs
app.get("/search/:key", async function(req, res) {
  //Reading the key
  let currentKey = req.params.key;
  console.log("Current key:", currentKey);

//Here we use the key, we check which index of the list has this key so we know at which page we are at
  result = _.findIndex(tokenList, (token) => token === currentKey);
  console.log("Current page", result);

  //If we already have saved the results of this page we can acces them without an request
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
    //If we have not saved the results yet we will look them up now using the nextPageToken
  } else {
    try {
      //Making a request to the YouTube api for the search response
      const searchResponse = await youtubeSearch.search.list({
        part: "id, snippet",
        q: searchQuery,
        type: "video",
        pageToken: tokenList[result] //We know at which index the token is by having the current page
      });
      //We save the new id's we got in the new list using the nextPageToken
      let searchVideoIDs = searchResponse.data?.items.map((item) => item.id.videoId);
      let searchChannelIDs = searchResponse.data?.items.map((item) => item.snippet.channelId);
      searchObject = searchResponse.data?.items;
      //Now doing the video request on the YouTube api again
      try {
        const videoResponse = await youtubeSearch.videos.list({
          part: "snippet, statistics, topicDetails, contentDetails",
          id: searchVideoIDs.join(",")
        });
        videoObject = videoResponse.data?.items;
      } catch (err) {
        //In case of an error we redirect to error.ejs, providing the error
        res.redirect("/search/error/" + encodeURIComponent(err.message));
        //This prevents another error
        return;
      }
        //Now doing the channel request on the YouTube api again
      try {
        const channelResponse = await youtubeSearch.channels.list({
          part: "snippet",
          id: searchChannelIDs.join(",")
        });
        channelObject = channelResponse.data?.items;
      } catch (err) {
        //In case of an error we redirect to error.ejs, providing the error
        res.redirect("/search/error/" + encodeURIComponent(err.message));
        //This prevents another error
        return;
      }
    } catch (err) {
      //In case of an error we redirect to error.ejs, providing the error
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      //This prevents another error
      return;
    }
    //Add the data in an array so we can acces the data in the above if statement, this saves api key usage
    loadedPages.push([videoObject, channelObject]);
    //Loads resultPage.ejs with the right variables
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

//This is the error page from error.ejs with the error in the url
app.get("/search/error/:error", function(req, res) {
  //We read the code and save it
  errorCode = req.params.error;
  //We render the error.ejs page and show the errorcode
  res.render("error", {
    errorCode: errorCode
  })
});

//The about page
app.get("/about", function(req, res) {
  //Loads in about.ejs
  res.render("about",{} )
});

//The feedback page
app.get("/feedback", function(req,res){
  //Loads in feedback.ejs
  res.render("feedback",{})
});

//Activated by the download button at resultPage.ejs
app.post("/download", function(req, res) {
  //redirects to /download:keyword
  res.redirect("/download" + searchQuery);
});

//Redirected to /download with the keyword so we can create a unique and recognizable filename to be downloaded
app.get("/download:keyword", async function(req, res) {
  console.log("redirect succeeded");
  //We are using the tokenList.length because our id arrays have a list of id's per index and the tokenList.length is the same as both arrays indexes
  for (let y = 0; y < tokenList.length; y++) {
    try {
      //Doing the video request to the YouTube api server
      const videoResponse = await youtubeSearch.videos.list({
        part: "snippet, statistics, topicDetails, contentDetails",
        id: videoIDs[y] // using the video list
      });
      videoObject = videoResponse.data?.items;
    } catch (err) {
      //In case of an error we redirect to error.ejs, providing the error
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      //This prevents another error
      return;
    }
    try {
      //Doing the channel request to the YouTube Api server
      const channelResponse = await youtubeSearch.channels.list({
        part: "snippet",
        id: channelIDs[y]
      });
      channelObject = channelResponse.data?.items;
    } catch (err) {
      //NEXT
      //In case of an error we redirect to error.ejs, providing the error
      res.redirect("/search/error/" + encodeURIComponent(err.message));
      //This prevents another error
      return;
    }
    //Pushing the objects into an array so the can be accesed
    loadedPages.push([videoObject, channelObject]);
    //Going through every video so we can add the data to be downloaded into a new array
    for (let x = 0; x < videoIDs[y].length; x++) {
      finalFile.push([loadedPages[y][0][x]?.snippet?.title || "", loadedPages[y][0][x]?.snippet?.thumbnails?.high?.url || "", loadedPages[y][1][x]?.snippet?.title || "", loadedPages[y][0][x]?.snippet?.description || "", loadedPages[y][0][x]?.snippet.publishedAt || "", videoUrl + videoIDs[y][x], loadedPages[y][0][x]?.statistics.viewCount || "", loadedPages[y][0][x]?.statistics.likeCount || "", loadedPages[y][0][x]?.statistics?.commentCount || "disabled", loadedPages[y][1][x]?.snippet?.description || "", loadedPages[y][0][x]?.topicDetails?.topicCategories?.join(",") || "", loadedPages[y][0][x]?.snippet?.defaultAudioLanguage || "not available", loadedPages[y][0][x]?.snippet?.tags?.join(",") || "", loadedPages[y][0][x]?.contentDetails?.duration || ""]);
    }
  }

  console.log("downloadFile", finalFile);
  //Flatten the array so it can be iterated over by the npm package
  finalFile.flat();
  console.log("downloadfile", finalFile);
  //Turning the array into csv format with the npm package
  const csvFromArrayOfArrays = await convertArrayToCSV([csv, ...finalFile], {
    csv,
    separator: ';'
  });
  //using the download function from above
  download(csvFromArrayOfArrays, searchQuery, res);
});


//The router channel
app.listen(3000, function() {
  console.log("app running on port 3000");
});
