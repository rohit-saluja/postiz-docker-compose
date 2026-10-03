"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramProvider = void 0;
const tslib_1 = require("tslib");
const make_is_1 = require("../../services/make.is");
const timer_1 = require("../../../../helpers/src/utils/timer");
const dayjs_1 = tslib_1.__importDefault(require("dayjs"));
const social_abstract_1 = require("../social.abstract");
const instagram_dto_1 = require("../../dtos/posts/providers-settings/instagram.dto");
const rules_description_decorator_1 = require("../../chat/rules.description.decorator");
// Instagram downloads media from the URL it is given, so local upload URLs
// (host.docker.internal / localhost, or a dead ngrok host) are swapped for
// Postiz's public https address (MAIN_URL, the named tunnel) at publish time.
const LOCAL_UPLOAD = /^https?:\/\/(?:host\.docker\.internal|localhost|127\.0\.0\.1|[a-z0-9-]+\.ngrok-free\.app)(?::\d+)?(\/uploads\/.+)$/;
async function publicMediaPath(path) {
    const frontend = process.env.FRONTEND_URL;
    const main = (process.env.MAIN_URL || '').replace(/\/+$/, '');
    const upload = path.match(LOCAL_UPLOAD)?.[1] ||
        (frontend && path.startsWith(`${frontend}/uploads/`)
            ? path.slice(frontend.length)
            : undefined);
    return upload && main.startsWith('https://') ? `${main}${upload}` : path;
}
let InstagramProvider = class InstagramProvider extends social_abstract_1.SocialAbstract {
    constructor() {
        super(...arguments);
        this.identifier = 'instagram';
        this.name = 'Instagram\n(Facebook Business)';
        this.isBetweenSteps = true;
        this.toolTip = 'Instagram must be business and connected to a Facebook page';
        this.scopes = [
            'instagram_basic',
            'pages_show_list',
            'pages_read_engagement',
            'business_management',
            'instagram_content_publish',
            'instagram_manage_comments',
            'instagram_manage_insights',
        ];
        this.maxConcurrentJob = 400;
        this.editor = 'normal';
        this.dto = instagram_dto_1.InstagramDto;
    }
    maxLength() {
        return 2200;
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
    handleErrors(body) {
        if (body.indexOf('An unknown error occurred') > -1) {
            return {
                type: 'retry',
                value: 'An unknown error occurred, please try again later',
            };
        }
        if (body.indexOf('2207081') > -1) {
            return {
                type: 'bad-body',
                value: "This account doesn't support Trial Reels",
            };
        }
        if (body.indexOf('REVOKED_ACCESS_TOKEN') > -1) {
            return {
                type: 'refresh-token',
                value: 'Something is wrong with your connected user, please re-authenticate',
            };
        }
        if (body.toLowerCase().indexOf('the user is not an instagram business') > -1) {
            return {
                type: 'refresh-token',
                value: 'Your Instagram account is not a business account, please convert it to a business account',
            };
        }
        if (body.toLowerCase().indexOf('session has been invalidated') > -1) {
            return {
                type: 'refresh-token',
                value: 'Please re-authenticate your Instagram account',
            };
        }
        if (body.indexOf('2207050') > -1) {
            return {
                type: 'bad-body',
                value: 'Instagram user is restricted',
            };
        }
        if (body.indexOf('2207003') > -1) {
            return {
                type: 'bad-body',
                value: 'Timeout downloading media, please try again',
            };
        }
        if (body.indexOf('2207020') > -1) {
            return {
                type: 'bad-body',
                value: 'Media expired, please upload again',
            };
        }
        if (body.indexOf('2207032') > -1) {
            return {
                type: 'bad-body',
                value: 'Failed to create media, please try again',
            };
        }
        if (body.indexOf('2207053') > -1) {
            return {
                type: 'bad-body',
                value: 'Unknown upload error, please try again',
            };
        }
        if (body.indexOf('2207052') > -1) {
            return {
                type: 'bad-body',
                value: 'Media fetch failed, please try again',
            };
        }
        if (body.indexOf('2207057') > -1) {
            return {
                type: 'bad-body',
                value: 'Invalid thumbnail offset for video',
            };
        }
        if (body.indexOf('2207026') > -1) {
            return {
                type: 'bad-body',
                value: 'Unsupported video format',
            };
        }
        if (body.indexOf('2207023') > -1) {
            return {
                type: 'bad-body',
                value: 'Unknown media type',
            };
        }
        if (body.indexOf('2207006') > -1) {
            return {
                type: 'bad-body',
                value: 'Media not found, please upload again',
            };
        }
        if (body.indexOf('2207008') > -1) {
            return {
                type: 'bad-body',
                value: 'Media builder expired, please try again',
            };
        }
        if (body.indexOf('2207028') > -1) {
            return {
                type: 'bad-body',
                value: 'Carousel validation failed',
            };
        }
        if (body.indexOf('2207010') > -1) {
            return {
                type: 'bad-body',
                value: 'Caption is too long',
            };
        }
        if (body.indexOf('2207035') > -1) {
            return {
                type: 'bad-body',
                value: 'Product tag positions not supported for videos',
            };
        }
        if (body.indexOf('2207036') > -1) {
            return {
                type: 'bad-body',
                value: 'Product tag positions required for photos',
            };
        }
        if (body.indexOf('2207037') > -1) {
            return {
                type: 'bad-body',
                value: 'Product tag validation failed',
            };
        }
        if (body.indexOf('2207040') > -1) {
            return {
                type: 'bad-body',
                value: 'Too many product tags',
            };
        }
        if (body.indexOf('2207004') > -1) {
            return {
                type: 'bad-body',
                value: 'Image is too large',
            };
        }
        if (body.indexOf('2207005') > -1) {
            return {
                type: 'bad-body',
                value: 'Unsupported image format',
            };
        }
        if (body.indexOf('2207009') > -1) {
            return {
                type: 'bad-body',
                value: 'Aspect ratio not supported, must be between 4:5 to 1.91:1',
            };
        }
        if (body.indexOf('Page request limit reached') > -1) {
            return {
                type: 'bad-body',
                value: 'Page posting for today is limited, please try again tomorrow',
            };
        }
        if (body.indexOf('2207042') > -1) {
            return {
                type: 'bad-body',
                value: 'You have reached the maximum of 25 posts per day, allowed for your account',
            };
        }
        if (body.indexOf('Not enough permissions to post') > -1) {
            return {
                type: 'bad-body',
                value: 'Not enough permissions to post',
            };
        }
        if (body.indexOf('36003') > -1) {
            return {
                type: 'bad-body',
                value: 'Aspect ratio not supported, must be between 4:5 to 1.91:1',
            };
        }
        if (body.indexOf('190,') > -1) {
            return {
                type: 'bad-body',
                value: 'The account is missing some permissions to perform this action, please re-add the account and allow all permissions',
            };
        }
        if (body.indexOf('36001') > -1) {
            return {
                type: 'bad-body',
                value: 'Invalid Instagram image resolution max: 1920x1080px',
            };
        }
        if (body.indexOf('2207051') > -1) {
            return {
                type: 'bad-body',
                value: 'Instagram blocked your request',
            };
        }
        if (body.indexOf('2207001') > -1) {
            return {
                type: 'bad-body',
                value: 'Instagram detected that your post is spam, please try again with different content',
            };
        }
        if (body.indexOf('2207027') > -1) {
            return {
                type: 'bad-body',
                value: 'Unknown error, please try again later or contact support',
            };
        }
        if (body.indexOf('param collaborators is not allowed') > -1) {
            return {
                type: 'bad-body',
                value: 'Collaborators are not allowed for carousel'
            };
        }
        return undefined;
    }
    async reConnect(id, requiredId, accessToken) {
        const findPage = (await this.pages(accessToken)).find((p) => p.id === requiredId);
        const information = await this.fetchPageInformation(accessToken, {
            id: requiredId,
            pageId: findPage?.pageId,
        });
        return {
            id: information.id,
            name: information.name,
            accessToken: information.access_token,
            picture: information.picture,
            username: information.username,
        };
    }
    async generateAuthUrl() {
        const state = (0, make_is_1.makeId)(6);
        return {
            url: 'https://www.facebook.com/v20.0/dialog/oauth' +
                `?client_id=${process.env.FACEBOOK_APP_ID}` +
                `&redirect_uri=${encodeURIComponent(`${process.env.FRONTEND_URL}/integrations/social/instagram`)}` +
                `&state=${state}` +
                `&scope=${encodeURIComponent(this.scopes.join(','))}`,
            codeVerifier: (0, make_is_1.makeId)(10),
            state,
        };
    }
    async authenticate(params) {
        const getAccessToken = await (await fetch('https://graph.facebook.com/v20.0/oauth/access_token' +
            `?client_id=${process.env.FACEBOOK_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(`${process.env.FRONTEND_URL}/integrations/social/instagram${params.refresh ? `?refresh=${params.refresh}` : ''}`)}` +
            `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
            `&code=${params.code}`)).json();
        const { access_token, expires_in, ...all } = await (await fetch('https://graph.facebook.com/v20.0/oauth/access_token' +
            '?grant_type=fb_exchange_token' +
            `&client_id=${process.env.FACEBOOK_APP_ID}` +
            `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
            `&fb_exchange_token=${getAccessToken.access_token}`)).json();
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
        const seenPageIds = new Set();
        const allFacebookPages = [];
        const fetchPaginated = async (startUrl) => {
            let nextUrl = startUrl;
            while (nextUrl) {
                const response = await (await fetch(nextUrl)).json();
                if (response.data) {
                    for (const page of response.data) {
                        if (!seenPageIds.has(page.id)) {
                            seenPageIds.add(page.id);
                            allFacebookPages.push(page);
                        }
                    }
                }
                nextUrl = response.paging?.next;
            }
        };
        await fetchPaginated(`https://graph.facebook.com/v20.0/me/accounts?fields=id,instagram_business_account,username,name,picture.type(large)&limit=100&access_token=${accessToken}`);
        try {
            let bizUrl = `https://graph.facebook.com/v20.0/me/businesses?access_token=${accessToken}`;
            while (bizUrl) {
                const bizResponse = await (await fetch(bizUrl)).json();
                if (bizResponse.data) {
                    for (const business of bizResponse.data) {
                        try {
                            await fetchPaginated(`https://graph.facebook.com/v20.0/${business.id}/owned_pages?fields=id,instagram_business_account,username,name,picture.type(large)&limit=100&access_token=${accessToken}`);
                        }
                        catch {
                        }
                        try {
                            await fetchPaginated(`https://graph.facebook.com/v20.0/${business.id}/client_pages?fields=id,instagram_business_account,username,name,picture.type(large)&limit=100&access_token=${accessToken}`);
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
        const onlyConnectedAccounts = await Promise.all(allFacebookPages
            .filter((f) => f.instagram_business_account)
            .map(async (p) => {
            return {
                pageId: p.id,
                ...(await (await fetch(`https://graph.facebook.com/v20.0/${p.instagram_business_account.id}?fields=name,profile_picture_url&access_token=${accessToken}`)).json()),
                id: p.instagram_business_account.id,
            };
        }));
        return onlyConnectedAccounts.map((p) => ({
            pageId: p.pageId,
            id: p.id,
            name: p.name,
            picture: { data: { url: p.profile_picture_url } },
        }));
    }
    async fetchPageInformation(accessToken, data) {
        const { access_token, ...all } = await (await fetch(`https://graph.facebook.com/v20.0/${data.pageId}?fields=access_token,name,picture.type(large)&access_token=${accessToken}`)).json();
        const { id, name, profile_picture_url, username } = await (await fetch(`https://graph.facebook.com/v20.0/${data.id}?fields=username,name,profile_picture_url&access_token=${accessToken}`)).json();
        return {
            id,
            name,
            picture: profile_picture_url,
            access_token,
            username,
        };
    }
    async post(id, accessToken, postDetails, integration, type = 'graph.facebook.com') {
        const [firstPost] = postDetails;
        console.log('in progress', id);
        const isStory = firstPost.settings.post_type === 'story';
        const isTrialReel = !!firstPost.settings.is_trial_reel;
        const medias = await Promise.all(firstPost?.media?.map(async (media) => {
            const m = { ...media, path: await publicMediaPath(media.path) };
            const caption = firstPost.media?.length === 1
                ? `&caption=${encodeURIComponent(firstPost.message)}`
                : ``;
            const isCarousel = (firstPost?.media?.length || 0) > 1 && !isStory ? `&is_carousel_item=true` : ``;
            const mediaType = m.path.indexOf('.mp4') > -1
                ? firstPost?.media?.length === 1
                    ? isStory
                        ? `video_url=${m.path}&media_type=STORIES`
                        : `video_url=${m.path}&media_type=REELS&thumb_offset=${m?.thumbnailTimestamp || 0}`
                    : isStory
                        ? `video_url=${m.path}&media_type=STORIES`
                        : `video_url=${m.path}&media_type=VIDEO&thumb_offset=${m?.thumbnailTimestamp || 0}`
                : isStory
                    ? `image_url=${m.path}&media_type=STORIES`
                    : `image_url=${m.path}`;
            const trialParams = isTrialReel
                ? `&trial_params=${encodeURIComponent(JSON.stringify({
                    graduation_strategy: firstPost.settings.graduation_strategy || 'MANUAL',
                }))}`
                : ``;
            const collaborators = firstPost?.settings?.collaborators?.length && !isStory
                ? `&collaborators=${JSON.stringify(firstPost?.settings?.collaborators.map((p) => p.label))}`
                : ``;
            const { id: photoId } = await (await this.fetch(`https://${type}/v20.0/${id}/media?${mediaType}${isCarousel}${collaborators}${trialParams}&access_token=${accessToken}${caption}`, {
                method: 'POST',
            })).json();
            console.log('in progress2', id);
            let status = 'IN_PROGRESS';
            while (status === 'IN_PROGRESS') {
                const { status_code } = await (await this.fetch(`https://${type}/v20.0/${photoId}?access_token=${accessToken}&fields=status_code`, undefined, '', 0, true)).json();
                await (0, timer_1.timer)(30000);
                status = status_code;
            }
            console.log('in progress3', id);
            return photoId;
        }) || []);
        if (isStory && medias.length > 1) {
            let lastMediaId = '';
            let lastPermalink = '';
            for (const mediaCreationId of medias) {
                const { id: mediaId } = await (await this.fetch(`https://${type}/v20.0/${id}/media_publish?creation_id=${mediaCreationId}&access_token=${accessToken}&field=id`, {
                    method: 'POST',
                })).json();
                lastMediaId = mediaId;
                const { permalink } = await (await this.fetch(`https://${type}/v20.0/${mediaId}?fields=permalink&access_token=${accessToken}`)).json();
                lastPermalink = permalink;
            }
            return [
                {
                    id: firstPost.id,
                    postId: lastMediaId,
                    releaseURL: lastPermalink,
                    status: 'success',
                },
            ];
        }
        else if (medias.length === 1) {
            const { id: mediaId } = await (await this.fetch(`https://${type}/v20.0/${id}/media_publish?creation_id=${medias[0]}&access_token=${accessToken}&field=id`, {
                method: 'POST',
            })).json();
            const { permalink } = await (await this.fetch(`https://${type}/v20.0/${mediaId}?fields=permalink&access_token=${accessToken}`)).json();
            return [
                {
                    id: firstPost.id,
                    postId: mediaId,
                    releaseURL: permalink,
                    status: 'success',
                },
            ];
        }
        else {
            const { id: containerId, ...all3 } = await (await this.fetch(`https://${type}/v20.0/${id}/media?caption=${encodeURIComponent(firstPost?.message)}&media_type=CAROUSEL&children=${encodeURIComponent(medias.join(','))}&access_token=${accessToken}`, {
                method: 'POST',
            })).json();
            let status = 'IN_PROGRESS';
            while (status === 'IN_PROGRESS') {
                const { status_code } = await (await this.fetch(`https://${type}/v20.0/${containerId}?fields=status_code&access_token=${accessToken}`, undefined, '', 0, true)).json();
                await (0, timer_1.timer)(30000);
                status = status_code;
            }
            const { id: mediaId, ...all4 } = await (await this.fetch(`https://${type}/v20.0/${id}/media_publish?creation_id=${containerId}&access_token=${accessToken}&field=id`, {
                method: 'POST',
            })).json();
            const { permalink } = await (await this.fetch(`https://${type}/v20.0/${mediaId}?fields=permalink&access_token=${accessToken}`)).json();
            return [
                {
                    id: firstPost.id,
                    postId: mediaId,
                    releaseURL: permalink,
                    status: 'success',
                },
            ];
        }
    }
    async comment(id, postId, lastCommentId, accessToken, postDetails, integration, type = 'graph.facebook.com') {
        const [commentPost] = postDetails;
        const { id: commentId } = await (await this.fetch(`https://${type}/v20.0/${postId}/comments?message=${encodeURIComponent(commentPost.message)}&access_token=${accessToken}`, {
            method: 'POST',
        })).json();
        const { permalink } = await (await this.fetch(`https://${type}/v20.0/${postId}?fields=permalink&access_token=${accessToken}`)).json();
        return [
            {
                id: commentPost.id,
                postId: commentId,
                releaseURL: permalink,
                status: 'success',
            },
        ];
    }
    setTitle(name) {
        switch (name) {
            case 'likes': {
                return 'Likes';
            }
            case 'followers': {
                return 'Followers';
            }
            case 'reach': {
                return 'Reach';
            }
            case 'follower_count': {
                return 'Follower Count';
            }
            case 'views': {
                return 'Views';
            }
            case 'comments': {
                return 'Comments';
            }
            case 'shares': {
                return 'Shares';
            }
            case 'saves': {
                return 'Saves';
            }
            case 'replies': {
                return 'Replies';
            }
        }
        return '';
    }
    async analytics(id, accessToken, date, type = 'graph.facebook.com') {
        const until = (0, dayjs_1.default)().endOf('day').unix();
        const since = (0, dayjs_1.default)().subtract(date, 'day').unix();
        const { data, ...all } = await (await fetch(`https://${type}/v21.0/${id}/insights?metric=follower_count,reach&access_token=${accessToken}&period=day&since=${since}&until=${until}`)).json();
        const { data: data2, ...all2 } = await (await fetch(`https://${type}/v21.0/${id}/insights?metric_type=total_value&metric=likes,views,comments,shares,saves,replies&access_token=${accessToken}&period=day&since=${since}&until=${until}`)).json();
        const analytics = [];
        analytics.push(...(data?.map((d) => ({
            label: this.setTitle(d.name),
            percentageChange: 5,
            data: d.values.map((v) => ({
                total: v.value,
                date: (0, dayjs_1.default)(v.end_time).format('YYYY-MM-DD'),
            })),
        })) || []));
        analytics.push(...data2.map((d) => ({
            label: this.setTitle(d.name),
            percentageChange: 5,
            data: [
                {
                    total: d.total_value.value,
                    date: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                },
                {
                    total: d.total_value.value,
                    date: (0, dayjs_1.default)().add(1, 'day').format('YYYY-MM-DD'),
                },
            ],
        })));
        return analytics;
    }
    music(accessToken, data) {
        return this.fetch(`https://graph.facebook.com/v20.0/music/search?q=${encodeURIComponent(data.q)}&access_token=${accessToken}`);
    }
    async postAnalytics(integrationId, accessToken, postId, date, type = 'graph.facebook.com') {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        try {
            const { data } = await (await this.fetch(`https://${type}/v21.0/${postId}/insights?metric=views,reach,saved,likes,comments,shares&access_token=${accessToken}`)).json();
            if (!data || data.length === 0) {
                return [];
            }
            const result = [];
            for (const metric of data) {
                const value = metric.values?.[0]?.value;
                if (value === undefined)
                    continue;
                let label = '';
                switch (metric.name) {
                    case 'views':
                        label = 'Views';
                        break;
                    case 'reach':
                        label = 'Reach';
                        break;
                    case 'engagement':
                        label = 'Engagement';
                        break;
                    case 'saved':
                        label = 'Saves';
                        break;
                    case 'likes':
                        label = 'Likes';
                        break;
                    case 'comments':
                        label = 'Comments';
                        break;
                    case 'shares':
                        label = 'Shares';
                        break;
                }
                if (label) {
                    result.push({
                        label,
                        percentageChange: 0,
                        data: [{ total: String(value), date: today }],
                    });
                }
            }
            return result;
        }
        catch (err) {
            console.error('Error fetching Instagram post analytics:', err);
            return [];
        }
    }
};
exports.InstagramProvider = InstagramProvider;
exports.InstagramProvider = InstagramProvider = tslib_1.__decorate([
    (0, rules_description_decorator_1.Rules)("Instagram should have at least one attachment, if it's a story, it can have only one picture")
], InstagramProvider);
//# sourceMappingURL=instagram.provider.js.map