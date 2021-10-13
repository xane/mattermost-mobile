// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Q} from '@nozbe/watermelondb';
import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import moment, {Moment} from 'moment-timezone';
import React from 'react';
import {Text, TextStyle} from 'react-native';
import {of as of$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {getUserTimezone} from '@actions/local/timezone';
import FormattedDate from '@components/formatted_date';
import FormattedText from '@components/formatted_text';
import FormattedTime from '@components/formatted_time';
import {Preferences} from '@constants';
import {MM_TABLES} from '@constants/database';
import {getPreferenceAsBool} from '@helpers/api/preference';
import {getCurrentMomentForTimezone} from '@utils/helpers';
import {makeStyleSheetFromTheme} from '@utils/theme';

import type {WithDatabaseArgs} from '@typings/database/database';
import type PreferenceModel from '@typings/database/models/servers/preference';
import type UserModel from '@typings/database/models/servers/user';

type Props = {
    currentUser: UserModel;
    isMilitaryTime: boolean;
    showPrefix?: boolean;
    showTimeCompulsory?: boolean;
    showToday?: boolean;
    testID?: string;
    textStyles?: TextStyle;
    theme: Theme;
    time: Date | Moment;
    withinBrackets?: boolean;
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        text: {
            fontSize: 15,
            color: theme.centerChannelColor,
        },
    };
});

const CustomStatusExpiry = ({currentUser, isMilitaryTime, showPrefix, showTimeCompulsory, showToday, testID = '', textStyles = {}, theme, time, withinBrackets}: Props) => {
    const userTimezone = getUserTimezone(currentUser);
    const timezone = userTimezone.useAutomaticTimezone ? userTimezone.automaticTimezone : userTimezone.manualTimezone;
    const styles = getStyleSheet(theme);
    const currentMomentTime = getCurrentMomentForTimezone(timezone);
    const expiryMomentTime = timezone ? moment(time).tz(timezone) : moment(time);
    const plusSixDaysEndTime = currentMomentTime.clone().add(6, 'days').endOf('day');
    const tomorrowEndTime = currentMomentTime.clone().add(1, 'day').endOf('day');
    const todayEndTime = currentMomentTime.clone().endOf('day');
    const isCurrentYear = currentMomentTime.get('y') === expiryMomentTime.get('y');

    let dateComponent;
    if ((showToday && expiryMomentTime.isBefore(todayEndTime)) || expiryMomentTime.isSame(todayEndTime)) {
        dateComponent = (
            <FormattedText
                id='custom_status.expiry_time.today'
                defaultMessage='Today'
            />
        );
    } else if (expiryMomentTime.isAfter(todayEndTime) && expiryMomentTime.isSameOrBefore(tomorrowEndTime)) {
        dateComponent = (
            <FormattedText
                id='custom_status.expiry_time.tomorrow'
                defaultMessage='Tomorrow'
            />
        );
    } else if (expiryMomentTime.isAfter(tomorrowEndTime)) {
        let format = 'dddd';
        if (expiryMomentTime.isAfter(plusSixDaysEndTime) && isCurrentYear) {
            format = 'MMM DD';
        } else if (!isCurrentYear) {
            format = 'MMM DD, YYYY';
        }

        dateComponent = (
            <FormattedDate
                format={format}
                timezone={timezone}
                value={expiryMomentTime.toDate()}
            />
        );
    }

    const useTime = showTimeCompulsory || !(expiryMomentTime.isSame(todayEndTime) || expiryMomentTime.isAfter(tomorrowEndTime));

    return (
        <Text
            testID={testID}
            style={[styles.text, textStyles]}
        >
            {withinBrackets && '('}
            {showPrefix && (
                <FormattedText
                    id='custom_status.expiry.until'
                    defaultMessage='Until'
                />
            )}
            {showPrefix && ' '}
            {dateComponent}
            {useTime && dateComponent && (
                <>
                    {' '}
                    <FormattedText
                        id='custom_status.expiry.at'
                        defaultMessage='at'
                    />
                    {' '}
                </>
            )}
            {useTime && (
                <FormattedTime
                    isMilitaryTime={isMilitaryTime}
                    timezone={timezone || ''}
                    value={expiryMomentTime.toDate()}
                />
            )}
            {withinBrackets && ')'}
        </Text>
    );
};

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => ({
    isMilitaryTime: database.get<PreferenceModel>(MM_TABLES.SERVER.PREFERENCE).
        query(
            Q.where('category', Preferences.CATEGORY_DISPLAY_SETTINGS),
        ).observe().pipe(
            switchMap(
                (preferences) => of$(getPreferenceAsBool(preferences, Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', false)),
            ),
        ),
}));

export default withDatabase(enhanced(CustomStatusExpiry));