'use strict';
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
exports.__esModule = true;
//Switching 'require' to 'import' for compatibility
var database_1 = require("../database");
var plugins_1 = require("../plugins");
var Posts = /** @class */ (function () {
    function Posts() {
    }
    //bookmark and unbookmark are public methods. Not sure what the types of pid and uid should be.
    // the return value is the same type as the return value of toggleBookmark
    Posts.bookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toggleBookmark('bookmark', pid, uid)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ;
    Posts.unbookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.toggleBookmark('unbookmark', pid, uid)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ;
    //toggleBookmark is a private method. In this case whenever the method is called, the type is a string.
    Posts.toggleBookmark = function (type, pid, uid) {
        return __awaiter(this, void 0, void 0, function () {
            var isBookmarking, postData, hasBookmarked, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (uid <= 0) { // uid needs to be casted to a number
                            throw new Error('[[error:not-logged-in]]');
                        }
                        isBookmarking = type === 'bookmark';
                        return [4 /*yield*/, Posts.getPostFields(pid, ['pid', 'uid'])];
                    case 1:
                        postData = _b.sent();
                        return [4 /*yield*/, Posts.hasBookmarked(pid, uid)];
                    case 2:
                        hasBookmarked = _b.sent();
                        // I avoid using promise.all here because it wouldn't allow me to add types to postData and hasBookmarked		
                        if (isBookmarking && hasBookmarked) {
                            throw new Error('[[error:already-bookmarked]]');
                        }
                        if (!isBookmarking && !hasBookmarked) {
                            throw new Error('[[error:already-unbookmarked]]');
                        }
                        if (!isBookmarking) return [3 /*break*/, 4];
                        return [4 /*yield*/, database_1["default"].sortedSetAdd("uid:".concat(uid, ":bookmarks"), Date.now(), pid)];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, database_1["default"].sortedSetRemove("uid:".concat(uid, ":bookmarks"), pid)];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6: return [4 /*yield*/, database_1["default"][isBookmarking ? 'setAdd' : 'setRemove']("pid:".concat(pid, ":users_bookmarked"), uid)];
                    case 7:
                        _b.sent();
                        _a = postData;
                        return [4 /*yield*/, database_1["default"].setCount("pid:".concat(pid, ":users_bookmarked"))];
                    case 8:
                        _a.bookmarks = _b.sent();
                        // The next line calls a function in a module that has not been updated to TS (setPostField - src/posts/data.js). 
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                        return [4 /*yield*/, Posts.setPostField(pid, 'bookmarks', postData.bookmarks)];
                    case 9:
                        // The next line calls a function in a module that has not been updated to TS (setPostField - src/posts/data.js). 
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                        _b.sent();
                        plugins_1["default"].hooks.fire("action:post.".concat(type), {
                            pid: pid,
                            uid: uid,
                            owner: postData.uid,
                            current: hasBookmarked ? 'bookmarked' : 'unbookmarked'
                        });
                        return [2 /*return*/, {
                                post: postData,
                                isBookmarked: isBookmarking
                            }];
                }
            });
        });
    };
    Posts.hasBookmarked = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function () {
            var sets;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (uid <= 0) {
                            return [2 /*return*/, Array.isArray(pid) ? pid.map(function () { return false; }) : false];
                        }
                        if (!Array.isArray(pid)) return [3 /*break*/, 2];
                        sets = pid.map(function (pid) { return "pid:".concat(pid, ":users_bookmarked"); });
                        return [4 /*yield*/, database_1["default"].isMemberOfSets(sets, uid)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, database_1["default"].isSetMember("pid:".concat(pid, ":users_bookmarked"), uid)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ;
    return Posts;
}());
exports["default"] = Posts;
;
