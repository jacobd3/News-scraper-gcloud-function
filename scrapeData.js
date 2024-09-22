const puppeteer = require("puppeteer");
const functions = require("@google-cloud/functions-framework");

async function scrapeData(keyword) {
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();

  await page.goto("https://businessinsider.com.pl/najnowsze", {
    waitUntill: "domcontentloaded",
  });

  await page.$eval(`.header-icon-link`, (el) => el.click());
  await page.$eval(
    "#inpsearch",
    (el, keyword) => (el.value = keyword),
    keyword
  );
  await page.$eval(".header-search_icon-link", (el) => el.click());
  await page.waitForNavigation();

  const allArticles = [];

  async function scrapeData() {
    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll(".list-item");
      return Array.from(articleElements).map((article) => {
        const img = article.querySelector("img").getAttribute("src")
          ? article.querySelector("img").getAttribute("src")
          : article.querySelector("picture").getAttribute("data-src");
        const title = article.querySelector(".item_title")?.innerText;
        const cat = article.querySelector(".item_category")?.innerText;
        const url = article.getAttribute("href");
        const date = article.querySelector(".item_time")?.innerText.split(" ");
        return { img, title, cat, url, date: date ? date : "" };
      });
    });
    allArticles.push(...articles);
  }

  await scrapeData();

  let yesterdayArticles = allArticles.filter((article) => {
    return article?.date[0]?.includes("wczoraj");
  });

  let counter = 1;

  while (yesterdayArticles.length == 0 && counter < 6) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    const elementContext = await page.evaluate((counter) => {
      element = document.querySelector(
        `a.pagination_item:nth-of-type(${counter})`
      );
      if (element) {
        element.click();
        return true;
      } else {
        return false;
      }
    }, counter);

    if (elementContext) {
      await page.waitForNavigation();
    }
    await scrapeData();

    yesterdayArticles = allArticles.filter((article) => {
      return article?.date[0]?.includes("wczoraj");
    });

    counter++;
  }

  browser.close();

  return allArticles.filter((article) => {
    return article?.date[0]?.includes("dzisiaj");
  });
}

exports.scrapeData = async function (req, res) {
  const keyword = Object.keys(req.body)[0];

  res.status(200).send(
    await scrapeData(keyword).then((result) => {
      return result;
    })
  );
};
