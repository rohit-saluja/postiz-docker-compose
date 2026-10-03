"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookProvider = void 0;
const tslib_1 = require("tslib");
const make_is_1 = require("../../services/make.is");
const dayjs_1 = tslib_1.__importDefault(require("dayjs"));
const social_abstract_1 = require("../social.abstract");
const facebook_dto_1 = require("../../dtos/posts/providers-settings/facebook.dto");
const fs_1 = require("fs");
const path_1 = require("path");
// Facebook downloads `file_url` / `url` media itself, which cannot reach local
// uploads (host.docker.internal / localhost, or a dead ngrok FRONTEND_URL). Local
// uploads are read from the uploads volume and sent as multipart `source` instead.
const LOCAL_UPLOAD = /^https?:\/\/(?:host\.docker\.internal|localhost|127\.0\.0\.1)(?::\d+)?\/uploads\/([^?#]+)/;
const CONTENT_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
async function readMedia(url) {
    const frontend = process.env.FRONTEND_URL;
    const dir = process.env.UPLOAD_DIRECTORY;
    const rel = url.match(LOCAL_UPLOAD)?.[1] ||
        (frontend && url.startsWith(`${frontend}/uploads/`)
            ? url.slice(`${frontend}/uploads/`.length).split(/[?#]/)[0]
            : undefined);
    const name = path_1.basename((rel || new URL(url).pathname));
    const type = CONTENT_TYPES[name.split('.').pop()?.toLowerCase() || ''] || 'application/octet-stream';
    if (rel && dir) {
        const root = path_1.resolve(dir);
        const file = path_1.resolve(root, decodeURIComponent(rel));
        if (file.startsWith(root + path_1.sep) && fs_1.existsSync(file)) {
            return { name, type, blob: new Blob([await fs_1.promises.readFile(file)], { type }) };
        }
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`media download failed (${res.status}): ${url}`);
    }
    return { name, type, blob: new Blob([await res.arrayBuffer()], { type }) };
}
class FacebookProvider extends social_abstract_1.SocialAbstract {
    constructor() {
        super(...arguments);
        this.identifier = 'facebook';
        this.name = 'Facebook Page';
        this.isBetweenSteps = true;
        this.scopes = [
            'pages_show_list',
            'business_management',
            'pages_manage_posts',
            'pages_manage_engagement',
            'pages_read_engagement',
            'read_insights',
        ];
        this.maxConcurrentJob = 100;
        this.editor = 'normal';
        this.dto = facebook_dto_1.FacebookDto;
    }
    maxLength() {
        return 63206;
    }
    handleErrors(body) {
        if (body.indexOf('Error validating access token') > -1) {
            return {
                type: 'refresh-token',
                value: 'Please re-authenticate your Facebook account',
            };
        }
        if (body.indexOf('490') > -1) {
            return {
                type: 'refresh-token',
                value: 'Access token expired, please re-authenticate',
            };
        }
        if (body.indexOf('REVOKED_ACCESS_TOKEN') > -1) {
            return {
                type: 'refresh-token',
                value: 'Access token has been revoked, please re-authenticate',
            };
        }
        if (body.indexOf('1366046') > -1) {
            return {
                type: 'bad-body',
                value: 'Photos should be smaller than 4 MB and saved as JPG, PNG',
            };
        }
        if (body.indexOf('1390008') > -1) {
            return {
                type: 'bad-body',
                value: 'You are posting too fast, please slow down',
            };
        }
        if (body.indexOf('1346003') > -1) {
            return {
                type: 'bad-body',
                value: 'Content flagged as abusive by Facebook',
            };
        }
        if (body.indexOf('1404006') > -1) {
            return {
                type: 'bad-body',
                value: "We couldn't post your comment, A security check in facebook required to proceed.",
            };
        }
        if (body.indexOf('1404102') > -1) {
            return {
                type: 'bad-body',
                value: 'Content violates Facebook Community Standards',
            };
        }
        if (body.indexOf('1404078') > -1) {
            return {
                type: 'refresh-token',
                value: 'Page publishing authorization required, please re-authenticate',
            };
        }
        if (body.indexOf('1609008') > -1) {
            return {
                type: 'bad-body',
                value: 'Cannot post Facebook.com links',
            };
        }
        if (body.indexOf('2061006') > -1) {
            return {
                type: 'bad-body',
                value: 'Invalid URL format in post content',
            };
        }
        if (body.indexOf('1349125') > -1) {
            return {
                type: 'bad-body',
                value: 'Invalid content format',
            };
        }
        if (body.indexOf('1404112') > -1) {
            return {
                type: 'bad-body',
                value: 'For security reasons, your account has limited access to the site for a few days',
            };
        }
        if (body.indexOf('Name parameter too long') > -1) {
            return {
                type: 'bad-body',
                value: 'Post content is too long',
            };
        }
        if (body.indexOf('1363047') > -1) {
            return {
                type: 'bad-body',
                value: 'Facebook service temporarily unavailable',
            };
        }
        if (body.indexOf('1609010') > -1) {
            return {
                type: 'bad-body',
                value: 'Facebook service temporarily unavailable',
            };
        }
        return undefined;
    }
    async refreshToken(refresh_token) {
        return {
            refreshToken: '',
            expiresIn: 0,
            accessToken: '',
            id: '',
            name: '',
            picture: '',
            username: '',
        };
    }
    async generateAuthUrl() {
        const state = (0, make_is_1.makeId)(6);
        return {
            url: 'https://www.facebook.com/v20.0/dialog/oauth' +
                `?client_id=${process.env.FACEBOOK_APP_ID}` +
                `&redirect_uri=${encodeURIComponent(`${process.env.FRONTEND_URL}/integrations/social/facebook`)}` +
                `&state=${state}` +
                `&scope=${this.scopes.join(',')}`,
            codeVerifier: (0, make_is_1.makeId)(10),
            state,
        };
    }
    async reConnect(id, requiredId, accessToken) {
        const information = await this.fetchPageInformation(accessToken, {
            page: requiredId,
        });
        return {
            id: information.id,
            name: information.name,
            accessToken: information.access_token,
            picture: information.picture,
            username: information.username,
        };
    }
    async authenticate(params) {
        const getAccessToken = await (await fetch('https://graph.facebook.com/v20.0/oauth/access_token' +
            `?client_id=${process.env.FACEBOOK_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(`${process.env.FRONTEND_URL}/integrations/social/facebook${params.refresh ? `?refresh=${params.refresh}` : ''}`)}` +
            `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
            `&code=${params.code}`)).json();
        const { access_token } = await (await fetch('https://graph.facebook.com/v20.0/oauth/access_token' +
            '?grant_type=fb_exchange_token' +
            `&client_id=${process.env.FACEBOOK_APP_ID}` +
            `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
            `&fb_exchange_token=${getAccessToken.access_token}&fields=access_token,expires_in`)).json();
        const { data } = await (await fetch(`https://graph.facebook.com/v20.0/me/permissions?access_token=${access_token}`)).json();
        const permissions = data
            .filter((d) => d.status === 'granted')
            .map((p) => p.permission);
        this.checkScopes(this.scopes, permissions);
        const { id, name, picture } = await (await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name,picture&access_token=${access_token}`)).json();
        return {
            id,
            name,
            accessToken: access_token,
            refreshToken: access_token,
            expiresIn: (0, dayjs_1.default)().add(59, 'days').unix() - (0, dayjs_1.default)().unix(),
            picture: picture?.data?.url || '',
            username: '',
        };
    }
    async pages(accessToken) {
        const seenIds = new Set();
        const allPages = [];
        const fetchPaginated = async (startUrl) => {
            let nextUrl = startUrl;
            while (nextUrl) {
                const response = await (await fetch(nextUrl)).json();
                if (response.data) {
                    for (const page of response.data) {
                        if (!seenIds.has(page.id)) {
                            seenIds.add(page.id);
                            allPages.push(page);
                        }
                    }
                }
                nextUrl = response.paging?.next;
            }
        };
        await fetchPaginated(`https://graph.facebook.com/v20.0/me/accounts?fields=id,username,name,access_token,picture.type(large)&limit=100&access_token=${accessToken}`);
        try {
            let bizUrl = `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`;
            while (bizUrl) {
                const bizResponse = await (await fetch(bizUrl)).json();
                if (bizResponse.data) {
                    for (const business of bizResponse.data) {
                        try {
                            await fetchPaginated(`https://graph.facebook.com/v20.0/${business.id}/owned_pages?fields=id,username,name,access_token,picture.type(large)&limit=100&access_token=${accessToken}`);
                        }
                        catch {
                        }
                        try {
                            await fetchPaginated(`https://graph.facebook.com/v20.0/${business.id}/client_pages?fields=id,username,name,access_token,picture.type(large)&limit=100&access_token=${accessToken}`);
                        }
                        catch {
                        }
                    }
                }
                bizUrl = bizResponse.paging?.next;
            }
        }
        catch {
        }
        return allPages;
    }
    async fetchPageInformation(accessToken, data) {
        const pageId = data.page;
        const fields = 'id,username,name,access_token,picture.type(large)';
        const searchPaginated = async (startUrl) => {
            let url = startUrl;
            while (url) {
                const response = await (await fetch(url)).json();
                if (response.data) {
                    const page = response.data.find((p) => String(p.id) === String(pageId));
                    if (page) {
                        return {
                            id: page.id,
                            name: page.name,
                            access_token: page.access_token,
                            picture: page.picture?.data?.url || '',
                            username: page.username,
                        };
                    }
                }
                url = response.paging?.next;
            }
            return null;
        };
        const fromAccounts = await searchPaginated(`https://graph.facebook.com/v20.0/me/accounts?fields=${fields}&limit=100&access_token=${accessToken}`);
        if (fromAccounts)
            return fromAccounts;
        try {
            let bizUrl = `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`;
            while (bizUrl) {
                const bizResponse = await (await fetch(bizUrl)).json();
                if (bizResponse.data) {
                    for (const business of bizResponse.data) {
                        try {
                            const fromOwned = await searchPaginated(`https://graph.facebook.com/v20.0/${business.id}/owned_pages?fields=${fields}&limit=100&access_token=${accessToken}`);
                            if (fromOwned)
                                return fromOwned;
                        }
                        catch {
                        }
                        try {
                            const fromClient = await searchPaginated(`https://graph.facebook.com/v20.0/${business.id}/client_pages?fields=${fields}&limit=100&access_token=${accessToken}`);
                            if (fromClient)
                                return fromClient;
                        }
                        catch {
                        }
                    }
                }
                bizUrl = bizResponse.paging?.next;
            }
        }
        catch {
        }
        throw new Error('Page not found in your accounts');
    }
    async post(id, accessToken, postDetails) {
        const [firstPost] = postDetails;
        let finalId = '';
        let finalUrl = '';
        if ((firstPost?.media?.[0]?.path?.indexOf('mp4') || -2) > -1) {
            const video = await readMedia(firstPost.media[0].path);
            const form = new FormData();
            form.append('source', video.blob, video.name);
            form.append('description', firstPost.message);
            form.append('published', 'true');
            const { id: videoId } = await (await this.fetch(`https://graph-video.facebook.com/v20.0/${id}/videos?access_token=${accessToken}`, {
                method: 'POST',
                body: form,
            }, 'upload mp4')).json();
            finalUrl = `https://www.facebook.com/${id}/videos/${videoId}`;
            finalId = videoId;
        }
        else {
            const uploadPhotos = !firstPost?.media?.length
                ? []
                : await Promise.all(firstPost.media.map(async (media) => {
                    const photo = await readMedia(media.path);
                    const form = new FormData();
                    form.append('source', photo.blob, photo.name);
                    form.append('published', 'false');
                    const { id: photoId } = await (await this.fetch(`https://graph.facebook.com/v20.0/${id}/photos?access_token=${accessToken}`, {
                        method: 'POST',
                        body: form,
                    }, 'upload images slides')).json();
                    return { media_fbid: photoId };
                }));
            const { id: postId, permalink_url, ...all } = await (await this.fetch(`https://graph.facebook.com/v20.0/${id}/feed?access_token=${accessToken}&fields=id,permalink_url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...(uploadPhotos?.length ? { attached_media: uploadPhotos } : {}),
                    ...(firstPost?.settings?.url
                        ? { link: firstPost.settings.url }
                        : {}),
                    message: firstPost.message,
                    published: true,
                }),
            }, 'finalize upload')).json();
            finalUrl = permalink_url;
            finalId = postId;
        }
        return [
            {
                id: firstPost.id,
                postId: finalId,
                releaseURL: finalUrl,
                status: 'success',
            },
        ];
    }
    async comment(id, postId, lastCommentId, accessToken, postDetails, integration) {
        const [commentPost] = postDetails;
        const replyToId = lastCommentId || postId;
        const data = await (await this.fetch(`https://graph.facebook.com/v20.0/${replyToId}/comments?access_token=${accessToken}&fields=id,permalink_url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...(commentPost.media?.length
                    ? { attachment_url: commentPost.media[0].path }
                    : {}),
                message: commentPost.message,
            }),
        }, 'add comment')).json();
        return [
            {
                id: commentPost.id,
                postId: data.id,
                releaseURL: data.permalink_url,
                status: 'success',
            },
        ];
    }
    async analytics(id, accessToken, date) {
        const until = (0, dayjs_1.default)().endOf('day').unix();
        const since = (0, dayjs_1.default)().subtract(date, 'day').unix();
        const { data } = await (await fetch(`https://graph.facebook.com/v20.0/${id}/insights?metric=page_impressions_unique,page_posts_impressions_unique,page_post_engagements,page_daily_follows,page_video_views&access_token=${accessToken}&period=day&since=${since}&until=${until}`)).json();
        return (data?.map((d) => ({
            label: d.name === 'page_impressions_unique'
                ? 'Page Impressions'
                : d.name === 'page_post_engagements'
                    ? 'Posts Engagement'
                    : d.name === 'page_daily_follows'
                        ? 'Page followers'
                        : d.name === 'page_video_views'
                            ? 'Videos views'
                            : 'Posts Impressions',
            percentageChange: 5,
            data: d?.values?.map((v) => ({
                total: v.value,
                date: (0, dayjs_1.default)(v.end_time).format('YYYY-MM-DD'),
            })),
        })) || []);
    }
    async postAnalytics(integrationId, accessToken, postId, date) {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        try {
            const { data } = await (await this.fetch(`https://graph.facebook.com/v20.0/${postId}/insights?metric=post_impressions_unique,post_reactions_by_type_total,post_clicks,post_clicks_by_type&access_token=${accessToken}`)).json();
            if (!data || data.length === 0) {
                return [];
            }
            const result = [];
            for (const metric of data) {
                const value = metric.values?.[0]?.value;
                if (value === undefined)
                    continue;
                let label = '';
                let total = '';
                switch (metric.name) {
                    case 'post_impressions_unique':
                        label = 'Impressions';
                        total = String(value);
                        break;
                    case 'post_clicks':
                        label = 'Clicks';
                        total = String(value);
                        break;
                    case 'post_clicks_by_type':
                        if (typeof value === 'object') {
                            const totalClicks = Object.values(value).reduce((sum, v) => sum + v, 0);
                            label = 'Clicks by Type';
                            total = String(totalClicks);
                        }
                        break;
                    case 'post_reactions_by_type_total':
                        if (typeof value === 'object') {
                            const totalReactions = Object.values(value).reduce((sum, v) => sum + v, 0);
                            label = 'Reactions';
                            total = String(totalReactions);
                        }
                        break;
                }
                if (label) {
                    result.push({
                        label,
                        percentageChange: 0,
                        data: [{ total, date: today }],
                    });
                }
            }
            return result;
        }
        catch (err) {
            console.error('Error fetching Facebook post analytics:', err);
            return [];
        }
    }
}
exports.FacebookProvider = FacebookProvider;
//# sourceMappingURL=facebook.provider.js.map