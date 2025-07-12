"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var puppeteer_1 = require("puppeteer");
function testFractionDetection() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, page, testUrl, fractions, firstFraction, content, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🔍 Testing fraction detection...');
                    return [4 /*yield*/, puppeteer_1.default.launch({ headless: false })];
                case 1:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 2:
                    page = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 12, 13, 15]);
                    testUrl = 'https://unibs.coursecatalogue.cineca.it/insegnamenti/2025/8785_139960_2223/2025/8899/1498?coorte=2025&schemaid=3278';
                    console.log('📄 Navigating to:', testUrl);
                    return [4 /*yield*/, page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 30000 })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a;
                            var fractionLinks = document.querySelectorAll('.insegnamento-links a');
                            var results = [];
                            for (var _i = 0, fractionLinks_1 = fractionLinks; _i < fractionLinks_1.length; _i++) {
                                var link = fractionLinks_1[_i];
                                var name_1 = ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                var href = link.getAttribute('href') || '';
                                var fullUrl = href.startsWith('http') ? href : "https://unibs.coursecatalogue.cineca.it".concat(href);
                                results.push({ name: name_1, url: fullUrl });
                            }
                            return results;
                        })];
                case 6:
                    fractions = _a.sent();
                    console.log('🎯 Found fractions:', fractions);
                    if (!(fractions.length > 0)) return [3 /*break*/, 10];
                    console.log('✅ Fractions detected! Testing first fraction...');
                    firstFraction = fractions[0];
                    console.log('📖 Navigating to fraction:', firstFraction.name, firstFraction.url);
                    return [4 /*yield*/, page.goto(firstFraction.url, { waitUntil: 'networkidle0', timeout: 30000 })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a, _b, _c, _d;
                            var result = {};
                            // Look for content sections
                            var sections = document.querySelectorAll('dt, h2, h3, h4, .section-title');
                            for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
                                var section = sections_1[_i];
                                var text = ((_a = section.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                                if (text.includes('obiettivi formativi')) {
                                    var nextElement = section.nextElementSibling;
                                    if (nextElement) {
                                        result.goals = ((_b = nextElement.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '';
                                    }
                                }
                                if (text.includes('contenuti') || text.includes('programma')) {
                                    var nextElement = section.nextElementSibling;
                                    if (nextElement) {
                                        result.chapters = ((_c = nextElement.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
                                    }
                                }
                                if (text.includes('testi') || text.includes('bibliografia')) {
                                    var nextElement = section.nextElementSibling;
                                    if (nextElement) {
                                        result.books = ((_d = nextElement.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || '';
                                    }
                                }
                            }
                            return result;
                        })];
                case 9:
                    content = _a.sent();
                    console.log('📚 Extracted content:', content);
                    return [3 /*break*/, 11];
                case 10:
                    console.log('❌ No fractions found');
                    _a.label = 11;
                case 11: return [3 /*break*/, 15];
                case 12:
                    error_1 = _a.sent();
                    console.error('❌ Error:', error_1);
                    return [3 /*break*/, 15];
                case 13: return [4 /*yield*/, browser.close()];
                case 14:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 15: return [2 /*return*/];
            }
        });
    });
}
testFractionDetection();
