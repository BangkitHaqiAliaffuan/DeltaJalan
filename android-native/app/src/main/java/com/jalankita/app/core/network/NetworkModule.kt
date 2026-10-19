package com.jalankita.app.core.network

import com.jalankita.app.BuildConfig
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        // bbox: terima objek {x1..} (single /api/analyze) ATAU array [x1..] (batch);
        // serialize selalu objek agar PciService membaca ['x1']..['y2'] dengan benar.
        .add(BboxAdapter())
        .add(LenientDoubleAdapter())
        .add(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideOkHttp(authInterceptor: AuthInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
            .build()

    /**
     * Klien TANPA AuthInterceptor untuk reverse geocoding (Nominatim/LocationIQ/
     * OSRM/Overpass/Wilayah-id) — endpoint publik, timeout pendek agar rantai
     * 5-tier tidak menggantung. Kunci "reverseGeocode" agar tidak bentrok
     * dengan OkHttpClient utama.
     */
    @Provides
    @Singleton
    @Named("reverseGeocode")
    fun provideReverseGeocodeOkHttp(): OkHttpClient =
        com.jalankita.app.core.util.ReverseGeocoder.defaultClient()

    @Provides
    @Singleton
    fun provideApiService(moshi: Moshi, client: OkHttpClient): ApiService =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
}
