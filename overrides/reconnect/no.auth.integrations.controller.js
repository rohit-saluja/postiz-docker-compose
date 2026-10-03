"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoAuthIntegrationsController = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../../../../../libraries/nestjs-libraries/src/redis/redis.service");
const connect_integration_dto_1 = require("../../../../../libraries/nestjs-libraries/src/dtos/integrations/connect.integration.dto");
const integration_manager_1 = require("../../../../../libraries/nestjs-libraries/src/integrations/integration.manager");
const integration_service_1 = require("../../../../../libraries/nestjs-libraries/src/database/prisma/integrations/integration.service");
const permissions_ability_1 = require("../../services/auth/permissions/permissions.ability");
const swagger_1 = require("@nestjs/swagger");
const integration_missing_scopes_1 = require("../../../../../libraries/nestjs-libraries/src/integrations/integration.missing.scopes");
const auth_service_1 = require("../../../../../libraries/helpers/src/auth/auth.service");
const social_abstract_1 = require("../../../../../libraries/nestjs-libraries/src/integrations/social.abstract");
const permission_exception_class_1 = require("../../services/auth/permissions/permission.exception.class");
const refresh_integration_service_1 = require("../../../../../libraries/nestjs-libraries/src/integrations/refresh.integration.service");
const organization_service_1 = require("../../../../../libraries/nestjs-libraries/src/database/prisma/organizations/organization.service");
let NoAuthIntegrationsController = class NoAuthIntegrationsController {
    constructor(_integrationManager, _integrationService, _refreshIntegrationService, _organizationService) {
        this._integrationManager = _integrationManager;
        this._integrationService = _integrationService;
        this._refreshIntegrationService = _refreshIntegrationService;
        this._organizationService = _organizationService;
    }
    getIntegrations() {
        return this._integrationManager.getAllIntegrations();
    }
    async connectSocialMedia(integration, body) {
        if (!this._integrationManager
            .getAllowedSocialsIntegrations()
            .includes(integration)) {
            throw new Error('Integration not allowed');
        }
        const integrationProvider = this._integrationManager.getSocialIntegration(integration);
        const getCodeVerifier = integrationProvider.customFields
            ? 'none'
            : await redis_service_1.ioRedis.get(`login:${body.state}`);
        if (!getCodeVerifier) {
            throw new Error('Invalid state');
        }
        const organization = await redis_service_1.ioRedis.get(`organization:${body.state}`);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const org = await this._organizationService.getOrgById(organization);
        if (!integrationProvider.customFields) {
            await redis_service_1.ioRedis.del(`login:${body.state}`);
        }
        const details = integrationProvider.externalUrl
            ? await redis_service_1.ioRedis.get(`external:${body.state}`)
            : undefined;
        if (details) {
            await redis_service_1.ioRedis.del(`external:${body.state}`);
        }
        const refresh = await redis_service_1.ioRedis.get(`refresh:${body.state}`);
        if (refresh) {
            await redis_service_1.ioRedis.del(`refresh:${body.state}`);
        }
        const onboarding = await redis_service_1.ioRedis.get(`onboarding:${body.state}`);
        if (onboarding) {
            await redis_service_1.ioRedis.del(`onboarding:${body.state}`);
        }
        const { error, accessToken, expiresIn, refreshToken, id, name, picture, username, additionalSettings, } = await new Promise(async (res) => {
            try {
                const auth = await integrationProvider.authenticate({
                    code: body.code,
                    codeVerifier: getCodeVerifier,
                    refresh: body.refresh,
                }, details ? JSON.parse(details) : undefined);
                if (typeof auth === 'string') {
                    return res({
                        error: auth,
                        accessToken: '',
                        id: '',
                        name: '',
                        picture: '',
                        username: '',
                        additionalSettings: [],
                    });
                }
                if (refresh && integrationProvider.reConnect) {
                    console.log('reconnect');
                    try {
                        const newAuth = await integrationProvider.reConnect(auth.id, refresh, auth.accessToken);
                        // Override: keep the refresh token and expiry from authenticate(). Stock Postiz
                        // replaced them with body.refresh (empty), so a reconnected YouTube channel had
                        // no refresh token and broke an hour later.
                        return res({ ...newAuth, refreshToken: auth.refreshToken || body.refresh, expiresIn: auth.expiresIn });
                    }
                    catch (err) {
                        return res({
                            error: err.message,
                            accessToken: '',
                            id: '',
                            name: '',
                            picture: '',
                            username: '',
                            additionalSettings: [],
                        });
                    }
                }
                return res(auth);
            }
            catch (err) {
                if (err instanceof social_abstract_1.NotEnoughScopes) {
                    return res({
                        error: err.message,
                        accessToken: '',
                        id: '',
                        name: '',
                        picture: '',
                        username: '',
                        additionalSettings: [],
                    });
                }
                return res({
                    error: 'Authentication failed',
                    accessToken: '',
                    id: '',
                    name: '',
                    picture: '',
                    username: '',
                    additionalSettings: [],
                });
            }
        });
        if (error) {
            throw new social_abstract_1.NotEnoughScopes(error);
        }
        if (!id) {
            throw new social_abstract_1.NotEnoughScopes('Invalid API key');
        }
        if (refresh && String(id) !== String(refresh)) {
            throw new social_abstract_1.NotEnoughScopes('Please refresh the channel that needs to be refreshed');
        }
        let validName = name;
        if (!validName) {
            if (username) {
                validName = username.split('.')[0] ?? username;
            }
            else {
                validName = `Channel_${String(id).slice(0, 8)}`;
            }
        }
        if (process.env.STRIPE_PUBLISHABLE_KEY &&
            org.isTrailing &&
            (await this._integrationService.checkPreviousConnections(org.id, String(id)))) {
            throw new common_1.HttpException('', 412);
        }
        const createUpdate = await this._integrationService.createOrUpdateIntegration(additionalSettings, !!integrationProvider.oneTimeToken, org.id, validName.trim(), picture, 'social', String(id), integration, accessToken, refreshToken, expiresIn, username, refresh ? false : integrationProvider.isBetweenSteps, body.refresh, +body.timezone, details
            ? auth_service_1.AuthService.fixedEncryption(details)
            : integrationProvider.customFields
                ? auth_service_1.AuthService.fixedEncryption(Buffer.from(body.code, 'base64').toString())
                : integrationProvider.isChromeExtension
                    ? auth_service_1.AuthService.signJWT(JSON.parse(Buffer.from(body.code, 'base64').toString()))
                    : undefined);
        this._refreshIntegrationService
            .startRefreshWorkflow(org.id, createUpdate.id, integrationProvider)
            .catch((err) => {
            console.log(err);
        });
        let pages = [];
        if (integrationProvider.isBetweenSteps && !refresh) {
            try {
                const fetchMethod = 'pages' in integrationProvider
                    ? 'pages'
                    : 'companies' in integrationProvider
                        ? 'companies'
                        : null;
                if (fetchMethod) {
                    pages = await integrationProvider[fetchMethod](accessToken);
                }
            }
            catch (err) {
                console.log('Failed to fetch pages:', err);
            }
        }
        const webhookUrl = await redis_service_1.ioRedis.get(`webhookUrl:${body.state}`);
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        params: auth_service_1.AuthService.signJWT({
                            apiKey: org.apiKey,
                        }),
                    }),
                });
            }
            catch (err) { }
            await redis_service_1.ioRedis.del(`webhookUrl:${body.state}`);
        }
        const returnURL = await redis_service_1.ioRedis.get(`redirect:${body.state}`);
        if (returnURL) {
            await redis_service_1.ioRedis.del(`redirect:${body.state}`);
        }
        const extensionToken = integrationProvider.isChromeExtension
            ? auth_service_1.AuthService.signJWT({
                integrationId: createUpdate.id,
                organizationId: org.id,
                internalId: String(id),
                provider: integration,
            })
            : undefined;
        return {
            ...createUpdate,
            onboarding: onboarding === 'true',
            pages,
            ...(returnURL ? { returnURL } : {}),
            ...(extensionToken ? { extensionToken } : {}),
        };
    }
    async saveProviderPage(id, body) {
        if (!body.state) {
            throw new Error('Invalid state');
        }
        const organization = await redis_service_1.ioRedis.get(`organization:${body.state}`);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const org = await this._organizationService.getOrgById(organization);
        return this._integrationService.saveProviderPage(org.id, id, body);
    }
    async extensionRefreshCookies(body) {
        let payload;
        try {
            payload = auth_service_1.AuthService.verifyJWT(body.jwt);
        }
        catch {
            throw new common_1.HttpException('Invalid token', 401);
        }
        const { integrationId, organizationId, internalId, provider } = payload;
        if (!integrationId || !organizationId || !internalId || !provider) {
            throw new common_1.HttpException('Invalid token payload', 400);
        }
        const integration = await this._integrationService.getIntegrationById(organizationId, integrationId);
        if (!integration || integration.internalId !== internalId) {
            throw new common_1.HttpException('Integration not found', 404);
        }
        const integrationProvider = this._integrationManager.getSocialIntegration(provider);
        if (!integrationProvider?.isChromeExtension) {
            throw new common_1.HttpException('Not a Chrome extension integration', 400);
        }
        const authResult = await integrationProvider.authenticate({
            code: body.cookies,
            codeVerifier: '',
        });
        if (typeof authResult === 'string') {
            throw new common_1.HttpException(authResult, 400);
        }
        if (String(authResult.id) !== String(integration.internalId)) {
            await this._integrationService.refreshNeeded(organizationId, integrationId);
            return { success: false, reason: 'account_mismatch' };
        }
        await this._integrationService.createOrUpdateIntegration(undefined, false, organizationId, integration.name, undefined, 'social', integration.internalId, integration.providerIdentifier, authResult.accessToken, '', authResult.expiresIn, undefined, false, undefined, undefined, auth_service_1.AuthService.signJWT(JSON.parse(Buffer.from(body.cookies, 'base64').toString())));
        return { success: true };
    }
};
exports.NoAuthIntegrationsController = NoAuthIntegrationsController;
tslib_1.__decorate([
    (0, common_1.Get)('/'),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], NoAuthIntegrationsController.prototype, "getIntegrations", null);
tslib_1.__decorate([
    (0, common_1.Post)('/social-connect/:integration'),
    (0, permissions_ability_1.CheckPolicies)([permission_exception_class_1.AuthorizationActions.Create, permission_exception_class_1.Sections.CHANNEL]),
    (0, common_1.UseFilters)(new integration_missing_scopes_1.NotEnoughScopesFilter()),
    tslib_1.__param(0, (0, common_1.Param)('integration')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, connect_integration_dto_1.ConnectIntegrationDto]),
    tslib_1.__metadata("design:returntype", Promise)
], NoAuthIntegrationsController.prototype, "connectSocialMedia", null);
tslib_1.__decorate([
    (0, common_1.Post)('/public/provider/:id/connect'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], NoAuthIntegrationsController.prototype, "saveProviderPage", null);
tslib_1.__decorate([
    (0, common_1.Post)('/extension-refresh'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], NoAuthIntegrationsController.prototype, "extensionRefreshCookies", null);
exports.NoAuthIntegrationsController = NoAuthIntegrationsController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('Integrations'),
    (0, common_1.Controller)('/integrations'),
    tslib_1.__metadata("design:paramtypes", [integration_manager_1.IntegrationManager,
        integration_service_1.IntegrationService,
        refresh_integration_service_1.RefreshIntegrationService,
        organization_service_1.OrganizationService])
], NoAuthIntegrationsController);
//# sourceMappingURL=no.auth.integrations.controller.js.map