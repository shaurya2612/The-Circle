import React, { useState, useEffect } from "react";
import {
  View,
  Button,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Text
} from "react-native";
import { Field, reduxForm } from "redux-form";
import Colors from "../constants/Colors";
import { Image } from "native-base";
import * as AuthActions from "../store/actions/auth";
import { useDispatch, useSelector } from "react-redux";
import firebase, { database } from "firebase";
import DateTimePicker from "@react-native-community/datetimepicker";
import ModalDropdown from "react-native-modal-dropdown";
import { Icon } from "react-native-elements";
import * as ImagePicker from "expo-image-picker";
import * as Permissions from "expo-permissions";
import PhotoCard from "./PhotoCard";
import SignupFormPhoto from "./SignupFormPhoto";
import * as tempStorageActions from '../store/actions/tempStorage';
import HeaderText from "./HeaderText";
import FormText from "./Form/FormText";

const renderInput = ({ input: { onChange, ...input }, ...rest }) => {
  return (
    <TextInput
      autoCapitalize="none"
      style={styles.input}
      onChangeText={onChange}
      {...input}
      {...rest}
    />
  );
};

const myValidator = (values) => {
  const errors = {};
  if (!values.firstName) {
    show.firstName = "First name is required";
  } else if (values.firstName.length < 3) {
    errors.firstName = "Your name can't be that short!";
  }
  if (!values.email) {
    errors.email = "Hold on a minute, we need an email!";
  } else if (!/(.+)@(.+){2,}\.(.+){2,}/i.test(values.email)) {
    // use a more robust RegEx in real-life scenarios
    errors.email = "Valid email please!";
  }
  return errors;
};

function calculate_age(dob) {
  var diff_ms = Date.now() - dob.getTime();
  var age_dt = new Date(diff_ms);

  return Math.abs(age_dt.getUTCFullYear() - 1970);
}

const Form = (props) => {
  const phoneNumber = useSelector((state) => state.auth.phoneNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [message, showMessage] = useState(undefined);
  const [birthDate, setBirthDate] = useState(new Date());
  const [age, setAge] = useState(Math.floor((new Date() - birthDate) / 1000));
  const [show, setShow] = useState(false);
  const [moreSelected, setMoreSelected] = useState(false);
  const { handleSubmit } = props;
  const [interestedIn, setInterestedIn] = useState("Select");
  const [gender, setGender] = useState("Select");
  const [pickedImage, setPickedImage] = useState();
  const dispatch = useDispatch();

  const verifyPermissions = async () => {
    const result = await Permissions.askAsync(Permissions.CAMERA_ROLL);
    if (result.status != "granted") {
      Alert.alert(
        "Insufficient Permissions! You need to grant camera Permissions to use this app",
        [{ text: "Okay" }]
      );
      return false;
    }
    return true;
  };

  const takeImageHandler = async () => {
    const hasPermission = await verifyPermissions();
    if (!hasPermission) {
      return;
    }
    const image = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    setPickedImage(image.uri);
  };

  const submitHandler = async (values) => {
    setIsLoading(true);
    await firebase
      .auth()
      .createUserWithEmailAndPassword(
        phoneNumber + "@circle.com",
        values.password
      )
      .then((result) => {
        result.user.updateProfile({
          username: values.username,
          displayName: values.name,
        });
      });

    var user = firebase.auth().currentUser;
    // var temp = values.name.split(" ");
    // temp.map((item) => item[0].toUpperCase());
    // values.name = temp.join(" ");
    await firebase
      .database()
      .ref("usernames")
      .child(values.username)
      .set(user.uid);
    await firebase.database().ref("birthDates").child(user.uid).set(birthDate);
    if (moreSelected) {
      await firebase
        .database()
        .ref("genders")
        .child(user.uid)
        .set({
          gender: gender,
          genderIdentity: values.more,
          interestedIn:
            interestedIn === "Men"
              ? "Male"
              : interestedIn === "Women"
              ? "Female"
              : "Both",
        });
    } else {
      await firebase
        .database()
        .ref("genders")
        .child(user.uid)
        .set({
          gender: gender,
          genderIdentity: gender,
          interestedIn:
            interestedIn === "Men"
              ? "Male"
              : interestedIn === "Women"
              ? "Female"
              : "Both",
        });
    }
    const storage = firebase.storage();
    const uri = pickedImage;
    const uploadUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;
    const response = await fetch(uploadUri);
    const blob = await response.blob();

    await storage.ref(`/userImages/${user.uid}/0`).put(blob);

    const dpUrl = await storage
      .ref(`/userImages/${user.uid}/0`)
      .getDownloadURL();

    await firebase
      .database()
      .ref("users/" + user.uid)
      .set({
        username: values.username,
        name: values.name,
        age: age,
        displayPicture: dpUrl,
      });

  
    firebase.auth().currentUser.updateProfile({
      photoURL: dpUrl,
    });

    var obj = {};
    obj[user.uid] = 0;
    await firebase.database().ref("/matchingStatus").update(obj);

    dispatch(tempStorageActions.fetchCurrentUserGender())    
    setIsLoading(false);
  };

  const genders = ["Male", "Female", "More"];
  const genderInterestedIn = ["Men", "Women", "Both"];
  const moreGenders = ["Male", "Female", "Both"];
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.root}>
        {show && (
          <DateTimePicker
            testID="dateTimePicker"
            value={birthDate}
            mode="date"
            is24Hour={true}
            display="default"
            onChange={(event, date) => {
              if (date) {
                setBirthDate(date);
                const now = new Date();
                setAge(calculate_age(date));
              }
              setShow(false);
            }}
          />
        )}

        <View style={styles.card}>
          <Field
            name={"name"}
            props={{
              placeholder: "Enter Full Name",
            }}
            component={renderInput}
          />

          <View style={styles.birthDateContainer}>
            <TouchableOpacity
              onPress={() => {
                setShow(true);
              }}
              style={styles.button}
            >
              <FormText style={{ color: Colors.accent }}>Select Birth Date</FormText>
            </TouchableOpacity>
            <FormText style={{ color: Colors.primary }}>
              {birthDate
                ? birthDate.getDate().toString() +
                  "/" +
                  (birthDate.getMonth() + 1).toString() +
                  "/" +
                  birthDate.getFullYear().toString()
                  //  +
                  // "\t \t Age:" +
                  // age
                : null}
            </FormText>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-evenly",
              flexWrap: "wrap"
            }}
          >
            <HeaderText style={{ color: Colors.primary , fontSize:20}}>{"I am \t"}</HeaderText>
            <ModalDropdown
              style={{ ...styles.button, width: "35%" }}
              textStyle={{ color: Colors.accent }}
              options={genders}
              onSelect={(item) => {
                if (genders[item] == "More") {
                  setMoreSelected(true);
                } else setMoreSelected(false);
                setGender(genders[item]);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
              <FormText style={{ color: Colors.accent }}>
                  {moreSelected ? "More" : gender}
                </FormText>
                <Icon
                  name="chevron-down"
                  type="feather"
                  color={Colors.accent}
                  size={10}
                  style={{ marginHorizontal: 1 }}
                />
              </View>
            </ModalDropdown>
          </View>

          {moreSelected ? (
            <View>
              <Field
                name={"more"}
                props={{
                  placeholder: "Enter your Gender",
                }}
                component={renderInput}
              />
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-evenly",
              flexWrap:"wrap"
            }}
          >
            <HeaderText style={{ color: Colors.primary, fontSize:20 }}>
              {"Interested In "}
            </HeaderText>
            <ModalDropdown
              style={{ ...styles.button, width: "35%" }}
              textStyle={{ color: Colors.accent }}
              options={genderInterestedIn}
              onSelect={(item) => {
                setInterestedIn(genderInterestedIn[item]);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
              <FormText style={{ color: Colors.accent }}>{interestedIn}</FormText>
                <Icon
                  name="chevron-down"
                  type="feather"
                  color={Colors.accent}
                  size={10}
                  style={{ marginHorizontal: 1 }}
                />
              </View>
            </ModalDropdown>
          </View>

          {moreSelected ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-evenly",
                flexWrap:"wrap"
              }}
            >
              <HeaderText style={{ color: Colors.primary , fontSize:20}}>
                {"Show me in the search for "}
              </HeaderText>
              <ModalDropdown
                style={{ ...styles.button, width: "35%" }}
                textStyle={{ color: Colors.accent }}
                options={moreGenders}
                onSelect={(item) => {
                  setGender(moreGenders[item]);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                <FormText style={{ color: Colors.accent }}>
                    {gender == "More" ? "Select" : gender}
                  </FormText>
                  <Icon
                    name="chevron-down"
                    type="feather"
                    color={Colors.accent}
                    size={10}
                    style={{ marginHorizontal: 1 }}
                  />
                </View>
              </ModalDropdown>
            </View>
          ) : null}

          <Field
            name={"username"}
            props={{
              placeholder: "Enter a Username",
            }}
            component={renderInput}
          />

          <Field
            name={"password"}
            props={{
              placeholder: "Enter a Password",
              secureTextEntry: true,
            }}
            component={renderInput}
          />
          <Field
            name={"passwordConfirmation"}
            props={{
              placeholder: "Confirm Password",
              secureTextEntry: true,
            }}
            component={renderInput}
          />

          <View
            style={{
              justifyContent: "space-evenly",
              flexDirection: "row",
              alignItems: "center",
              flexWrap:"wrap",
              marginVertical: 10,
            }}
          >
            {pickedImage ? (
              <SignupFormPhoto image={pickedImage} />
            ) : (
              <HeaderText style={{ color: Colors.primary, fontSize:20 }}>Profile Picture</HeaderText>
            )}

            <TouchableOpacity
              style={{ ...styles.button, paddingHorizontal: 0 }}
              onPress={takeImageHandler}
            >
              <FormText style={{ color: Colors.accent }}>Choose</FormText>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit((values) => submitHandler(values))}
              >
                <FormText style={{ color: Colors.accent }}>Submit</FormText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {message ? (
          <TouchableOpacity
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 0xffffffee,
                justifyContent: "center",
                zIndex: 99,
              },
            ]}
            onPress={() => showMessage(undefined)}
          >
            <View style={styles.root}>
              <View style={styles.messageBox}>
                <Text
                  style={{
                    color: message.color || "blue",
                    fontSize: 17,
                    textAlign: "center",
                    margin: 20,
                  }}
                >
                  {message.text}
                </Text>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      showMessage(undefined);
                    }}
                    style={styles.button}
                  >
                    <FormText style={{ color: Colors.accent }}>Okay</FormText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : undefined}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  input: {
    padding: 15,
    marginBottom: 8,
    borderColor: Colors.primary,
    borderWidth: 2,
    borderRadius: 25,
    marginVertical: 20,
    marginHorizontal: 20,
    backgroundColor: Colors.accent,
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    marginVertical: 15,
    backgroundColor: Colors.primary,
    width: "50%",
    borderRadius: 50,
  },
  buttonContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  birthDateContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.accent,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    overflow: "scroll",
  },
});

export default reduxForm({ form: "SignupForm" })(Form);
