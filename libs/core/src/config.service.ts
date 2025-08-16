import { Injectable } from "@nestjs/common";
import { ConfigService as BaseConfigService, type ConfigGetOptions, type NoInferType, type Path, type PathValue } from "@nestjs/config";
import { configuration, type Configuration } from "@nuvix/utils";

@Injectable()
export class ConfigService
    <K = Configuration, WasValidated extends boolean = false>
    extends BaseConfigService<K, WasValidated> {

    constructor() {
        super(configuration);
    }

    getDatabaseConfig(): Configuration['database'] {
        return this.get('database' as keyof K) as Configuration['database'];
    }

    getRedisConfig(): Configuration['redis'] {
        return this.get('redis' as keyof K) as Configuration['redis'];
    }

    get assetConfig(): Configuration['assets'] {
        return this.get('assets' as keyof K) as Configuration['assets'];
    }

    getSmtpConfig(): Configuration['smtp'] {
        return this.get('smtp' as keyof K) as Configuration['smtp'];
    }

    get appLimits(): Configuration['limits'] {
        return this.get('limits' as keyof K) as Configuration['limits'];
    }

    /**
     * Get a configuration value (either custom configuration or process environment variable)
     * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
     * @param propertyPath
     */
    override get<T extends keyof K>(propertyPath: T): K[T];
    override get<T = any>(propertyPath: KeyOf<K>): ValidatedResult<WasValidated, T>;
    /**
     * Get a configuration value (either custom configuration or process environment variable)
     * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
     * @param propertyPath
     * @param options
     */
    override get<T = K, P extends Path<T> = any, R = PathValue<T, P>>(propertyPath: P, options: ConfigGetOptions): ValidatedResult<WasValidated, R>;
    /**
     * Get a configuration value (either custom configuration or process environment variable)
     * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
     * It returns a default value if the key does not exist.
     * @param propertyPath
     * @param defaultValue
     */
    override get<T = any>(propertyPath: KeyOf<K>, defaultValue: NoInferType<T>): T;
    /**
     * Get a configuration value (either custom configuration or process environment variable)
     * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
     * It returns a default value if the key does not exist.
     * @param propertyPath
     * @param defaultValue
     * @param options
     */
    override get<T = K, P extends Path<T> = any, R = PathValue<T, P>>(propertyPath: P, defaultValue: NoInferType<R>, options: ConfigGetOptions): Exclude<R, undefined>;
    /**
     * Get a configuration value (either custom configuration or process environment variable)
     * based on property path (you can use dot notation to traverse nested object, e.g. "database.host").
     * @param propertyPath
     */
    override get<T = any>(propertyPath: any, defaultValueOrOptions?: any, options?: any): ValidatedResult<WasValidated, T> {
        return super.get(propertyPath, defaultValueOrOptions, options) as ValidatedResult<WasValidated, T>;
    }
}

/**
 * `ValidatedResult<WasValidated, T>
 *
 * If `WasValidated` is `true`, return `T`.
 * Otherwise, constructs the type `T` with `undefined`.
 */
type ValidatedResult<WasValidated extends boolean, T> = WasValidated extends true ? T : T | undefined;

type KeyOf<T> = keyof T extends never ? string | symbol : keyof T;
